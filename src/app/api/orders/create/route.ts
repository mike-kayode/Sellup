import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, customers, products, coupons, stores, analyticsEvents } from "@/db/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { generateOrderNumber, formatPhoneNumber, generateWhatsAppLink, toMinorUnits, fromMinorUnits } from "@/lib/utils";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

class OrderRequestError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409) {
    super(message);
    this.name = "OrderRequestError";
  }
}

const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  idempotencyKey: z.string().uuid().optional(),
  customerName: z.string().min(2),
  customerPhone: z.string().min(10),
  customerEmail: z.string().email().optional().or(z.literal("")),
  deliveryAddress: z.string(),
  city: z.string(),
  state: z.string(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(100),
    })
  ).min(1).max(100),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createOrderSchema.parse(body);

    // Validate the store exists and is published
    const storeResult = await db
      .select({
        id: stores.id,
        storeName: stores.storeName,
        whatsappNumber: stores.whatsappNumber,
        isPublished: stores.isPublished,
        isSuspended: stores.isSuspended,
        isRestricted: stores.isRestricted,
      })
      .from(stores)
      .where(eq(stores.id, validatedData.storeId))
      .limit(1);

    if (storeResult.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const store = storeResult[0];

    if (!store.isPublished || store.isSuspended || store.isRestricted) {
      return NextResponse.json(
        { error: "Store is not accepting orders" },
        { status: 403 }
      );
    }

    if (validatedData.idempotencyKey) {
      const [existingOrder] = await db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        total: orders.total,
        status: orders.status,
      }).from(orders).where(eq(orders.idempotencyKey, validatedData.idempotencyKey)).limit(1);
      if (existingOrder) {
        return NextResponse.json({
          message: "Order already created",
          order: existingOrder,
          duplicate: true,
        }, { status: 200 });
      }
    }

    const formattedCustomerPhone = formatPhoneNumber(validatedData.customerPhone);
    const requestedQuantities = new Map<string, number>();
    for (const item of validatedData.items) {
      requestedQuantities.set(
        item.productId,
        (requestedQuantities.get(item.productId) || 0) + item.quantity
      );
    }

    let subtotalMinor = 0;
    let discountMinor = 0;
    let appliedCouponCode: string | undefined;
    let customerId = "";
    let createdOrder: { id: string; orderNumber: string; total: string } | undefined;
    const orderItems: Array<{
      productId: string;
      name: string;
      quantity: number;
      price: string;
      total: string;
    }> = [];
    const orderNumber = generateOrderNumber();
    const total = await db.transaction(async (tx) => {
      const [activeStore] = await tx.select({ id: stores.id }).from(stores).where(and(
        eq(stores.id, validatedData.storeId),
        eq(stores.isPublished, true),
        eq(stores.isSuspended, false),
        eq(stores.isRestricted, false)
      )).limit(1);
      if (!activeStore) throw new OrderRequestError("Store is not accepting orders", 403);

      const existingCustomers = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.storeId, validatedData.storeId), eq(customers.phone, formattedCustomerPhone)))
        .limit(1);

      if (existingCustomers.length === 0) {
        const [newCustomer] = await tx.insert(customers).values({
          storeId: validatedData.storeId,
          name: validatedData.customerName,
          phone: formattedCustomerPhone,
          email: validatedData.customerEmail,
          deliveryAddress: validatedData.deliveryAddress,
          city: validatedData.city,
          state: validatedData.state,
        }).onConflictDoNothing({ target: [customers.storeId, customers.phone] }).returning({ id: customers.id });
        if (newCustomer) {
          customerId = newCustomer.id;
        } else {
          const [conflictingCustomer] = await tx.select({ id: customers.id }).from(customers).where(
            and(eq(customers.storeId, validatedData.storeId), eq(customers.phone, formattedCustomerPhone))
          ).limit(1);
          if (!conflictingCustomer) throw new Error("Unable to create customer");
          customerId = conflictingCustomer.id;
        }
      } else {
        customerId = existingCustomers[0].id;
      }

      const productDetails = await tx.select().from(products).where(
        and(eq(products.storeId, validatedData.storeId), eq(products.isActive, true))
      );

      for (const [productId, quantity] of requestedQuantities) {
        const product = productDetails.find((candidate) => candidate.id === productId);
        if (!product) throw new OrderRequestError(`Product ${productId} not found or unavailable`, 404);
        if (product.stock !== null && product.stock <= 0) {
          throw new OrderRequestError(`Product "${product.name}" is out of stock`, 409);
        }
        if (product.stock !== null && product.stock < quantity) {
          throw new OrderRequestError(`Insufficient stock for "${product.name}"`, 409);
        }

        const itemTotalMinor = toMinorUnits(product.price) * quantity;
        subtotalMinor += itemTotalMinor;
        orderItems.push({ productId, name: product.name, quantity, price: product.price, total: fromMinorUnits(itemTotalMinor) });

        if (product.stock !== null && product.stock > 0) {
          const updated = await tx.update(products).set({ stock: sql`${products.stock} - ${quantity}`, updatedAt: new Date() })
            .where(and(
              eq(products.id, product.id),
              eq(products.isActive, true),
              sql`${products.stock} >= ${quantity}`
            )).returning({ id: products.id });
          if (updated.length === 0) throw new OrderRequestError(`Insufficient stock for "${product.name}"`, 409);
        }
      }

      if (validatedData.couponCode) {
        const [coupon] = await tx.select().from(coupons).where(and(
          eq(coupons.storeId, validatedData.storeId),
          eq(coupons.code, validatedData.couponCode.toUpperCase()),
          eq(coupons.isActive, true)
        )).limit(1);
        if (!coupon) {
          throw new OrderRequestError("Coupon code is invalid", 400);
        }

        if (coupon) {
          const valid = (!coupon.expiresAt || new Date(coupon.expiresAt) >= new Date()) &&
            (!coupon.minOrderAmount || subtotalMinor >= toMinorUnits(coupon.minOrderAmount));
          if (!valid) throw new OrderRequestError("Coupon code is no longer valid for this order", 400);

          const discountValue = parseFloat(coupon.discountValue);
          if (!Number.isFinite(discountValue) || discountValue < 0 ||
            (coupon.discountType === "percentage" && discountValue > 100)) {
            throw new OrderRequestError("Coupon discount is invalid", 400);
          }

          const usageUpdate = await tx.update(coupons).set({
            currentUsage: sql`coalesce(${coupons.currentUsage}, 0) + 1`,
          }).where(and(
            eq(coupons.id, coupon.id),
            eq(coupons.isActive, true),
            or(isNull(coupons.maxUsage), sql`coalesce(${coupons.currentUsage}, 0) < ${coupons.maxUsage}`),
            or(isNull(coupons.expiresAt), sql`${coupons.expiresAt} >= now()`)
          )).returning({ id: coupons.id });
          if (usageUpdate.length === 0) throw new OrderRequestError("Coupon usage limit reached", 409);

          discountMinor = coupon.discountType === "percentage"
            ? Math.round((subtotalMinor * discountValue) / 100)
            : Math.min(toMinorUnits(discountValue), subtotalMinor);
          appliedCouponCode = coupon.code;
        }
      }

      const calculatedTotalMinor = Math.max(0, subtotalMinor - discountMinor);
      const [newOrder] = await tx.insert(orders).values({
        storeId: validatedData.storeId,
        customerId,
        orderNumber,
        idempotencyKey: validatedData.idempotencyKey,
        items: orderItems,
        subtotal: fromMinorUnits(subtotalMinor),
        discount: fromMinorUnits(discountMinor),
        total: fromMinorUnits(calculatedTotalMinor),
        status: "pending",
        paymentStatus: "pending",
        notes: validatedData.notes,
        couponCode: appliedCouponCode,
      }).returning({ id: orders.id, orderNumber: orders.orderNumber, total: orders.total });
      createdOrder = newOrder;

      await tx.update(customers).set({
        totalSpent: sql`coalesce(${customers.totalSpent}, 0) + ${fromMinorUnits(calculatedTotalMinor)}`,
        totalOrders: sql`coalesce(${customers.totalOrders}, 0) + 1`,
        lastOrderDate: new Date(),
        updatedAt: new Date(),
      }).where(eq(customers.id, customerId));
      await tx.insert(analyticsEvents).values({
        storeId: validatedData.storeId,
        orderId: newOrder.id,
        eventName: "ORDER_CREATED",
        metadata: { orderNumber },
      });
      return calculatedTotalMinor;
    });

    // Format WhatsApp message (sent TO the business owner)
    const orderDetails = orderItems
      .map(
        (item) =>
          `${item.quantity} × ${item.name}\nPrice: ₦${parseFloat(
            item.price
          ).toLocaleString()}\nTotal: ₦${parseFloat(item.total).toLocaleString()}`
      )
      .join("\n\n");

    const whatsappMessage = `Hello ${store.storeName},

I would like to place an order.

Order ID: #${orderNumber}

Items:
${orderDetails}

---
Subtotal: ₦${(subtotalMinor / 100).toLocaleString()}
${
  discountMinor > 0
    ? `Discount: -₦${(discountMinor / 100).toLocaleString()}\n`
    : ""
}Total: ₦${(total / 100).toLocaleString()}

Customer:
${validatedData.customerName}

Phone:
${validatedData.customerPhone}

Delivery Address:
${validatedData.deliveryAddress}
${validatedData.city}, ${validatedData.state}
${
  validatedData.notes
    ? `\nNotes:\n${validatedData.notes}\n`
    : ""
}
Order placed through Sell Up.`;

    // Build WhatsApp link to the STORE's number
    const storeWhatsApp = formatPhoneNumber(store.whatsappNumber);
    const whatsappLink = generateWhatsAppLink(
      storeWhatsApp,
      whatsappMessage
    );

    // Fire-and-forget order confirmation to the customer (if provided).
    // Email failures must never fail the order.
    if (validatedData.customerEmail && createdOrder) {
      sendOrderConfirmationEmail(
        validatedData.customerEmail,
        createdOrder.orderNumber,
        createdOrder.total,
        store.storeName,
        validatedData.customerName
      ).catch((err) => console.error("Order confirmation email failed:", err));
    }

    // Fire-and-forget WhatsApp notification to the merchant about the new order.
    // WhatsApp failures must never fail the order.
    if (store.whatsappNumber && createdOrder) {
      const merchantWhatsAppMessage = `🛍️ *New Order on ${store.storeName}*\n\nOrder #${orderNumber}\nCustomer: ${validatedData.customerName}\nPhone: ${validatedData.customerPhone}\nTotal: ₦${(total / 100).toLocaleString()}\nItems: ${orderItems.length}\n\nReply to this message or open WhatsApp to contact the customer:\n${generateWhatsAppLink(formatPhoneNumber(validatedData.customerPhone), `Hello ${validatedData.customerName}, this is ${store.storeName}. We received your order #${orderNumber}. We'll confirm it shortly!`)}`;
      sendWhatsApp({
        to: formatPhoneNumber(store.whatsappNumber),
        message: merchantWhatsAppMessage,
      }).catch((err) => console.error("Order WhatsApp notification failed:", err));
    }

    return NextResponse.json(
      {
        message: "Order created successfully",
        order: createdOrder,
        whatsappMessage,
        whatsappLink,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof OrderRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
