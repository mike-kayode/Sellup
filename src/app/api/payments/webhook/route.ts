import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { analyticsEvents, orders, products, stores, subscriptions, payments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  validatePaystackWebhookSignature,
  validateFlutterwaveWebhookSignature,
} from "@/lib/payment";
import { getPlan } from "@/lib/subscriptions";
import { normalizePlan } from "@/lib/entitlements";

async function releaseOrderStock(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select({ storeId: orders.storeId, status: orders.status, items: orders.items })
      .from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.status === "cancelled") return;

    const items = Array.isArray(order.items) ? order.items as Array<{ productId: string; quantity: number }> : [];
    for (const item of items) {
      await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() })
        .where(and(eq(products.id, item.productId), sql`${products.stock} is not null`));
    }
    await tx.update(orders).set({ status: "cancelled", paymentStatus: "failed", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await tx.insert(analyticsEvents).values({ storeId: order.storeId, orderId, eventName: "ORDER_CANCELLED" });
  });
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-paystack-signature") || "";
    const body = await request.text();
    // Paystack signs webhooks with the account secret key unless a dedicated
    // webhook secret is configured — fall back so webhooks never fail on a
    // missing PAYSTACK_WEBHOOK_SECRET.
    const secret =
      process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || "";

    if (!validatePaystackWebhookSignature(body, signature, secret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);

    if (event.event === "charge.success") {
      const transaction = event.data;
      const reference = transaction.reference;
      const metadata = transaction.metadata || {};
      const storeId = metadata.storeId;
      const plan = metadata.plan;
      const now = new Date();

      if (storeId) {
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const normalizedPlan = normalizePlan(plan || "freemium");
        const planInfo = getPlan(normalizedPlan);

        const existingSubscription = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.storeId, storeId))
          .limit(1);

        if (existingSubscription.length > 0) {
          await db
            .update(subscriptions)
            .set({
              plan: normalizedPlan,
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              updatedAt: now,
            })
            .where(eq(subscriptions.storeId, storeId));
        } else {
          await db.insert(subscriptions).values({
            storeId,
            plan: normalizedPlan,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          });
        }

        await db
          .update(stores)
          .set({ plan: normalizedPlan, updatedAt: now })
          .where(eq(stores.id, storeId));
      }

      if (metadata.orderId) {
        await releaseOrderStock(metadata.orderId);
        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            status: "confirmed",
            updatedAt: now,
          })
          .where(eq(orders.id, metadata.orderId));
      }

      await db
        .update(payments)
        .set({ status: "success", paidAt: now })
        .where(eq(payments.reference, reference));

      console.log(`Payment successful for reference: ${reference}`);
    }

    if (event.event === "charge.failed") {
      const transaction = event.data;
      const reference = transaction.reference;
      const metadata = transaction.metadata || {};
      if (metadata.orderId) {
        await db
          .update(orders)
          .set({
            paymentStatus: "failed",
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, metadata.orderId));
      }

      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.reference, reference));

      console.log(`Payment failed for reference: ${reference}`);
    }

    return NextResponse.json(
      { message: "Webhook processed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const signature = request.headers.get("verif-hash") || "";
    const body = await request.text();
    const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET || "";

    if (!validateFlutterwaveWebhookSignature(body, signature, secret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);

    if (event.event === "charge.completed") {
      const transaction = event.data;
      const txRef = transaction.tx_ref;
      const metadata = transaction.metadata || {};
      const storeId = metadata.storeId;
      const plan = metadata.plan;
      const now = new Date();

      if (storeId) {
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const normalizedPlan = normalizePlan(plan || "freemium");

        const existingSubscription = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.storeId, storeId))
          .limit(1);

        if (existingSubscription.length > 0) {
          await db
            .update(subscriptions)
            .set({
              plan: normalizedPlan,
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              updatedAt: now,
            })
            .where(eq(subscriptions.storeId, storeId));
        } else {
          await db.insert(subscriptions).values({
            storeId,
            plan: normalizedPlan,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          });
        }

        await db
          .update(stores)
          .set({ plan: normalizedPlan, updatedAt: now })
          .where(eq(stores.id, storeId));
      }

      if (metadata.orderId) {
        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            status: "confirmed",
            updatedAt: now,
          })
          .where(eq(orders.id, metadata.orderId));
      }
      if (metadata.orderId || storeId) {
        await db
          .update(payments)
          .set({ status: "success", paidAt: now })
          .where(eq(payments.reference, txRef));
      }

      console.log(`Payment successful for transaction: ${transaction.id}`);
    }

    if (event.event === "charge.failed") {
      const transaction = event.data;
      const txRef = transaction.tx_ref;

      if (transaction.metadata?.orderId) {
        await releaseOrderStock(transaction.metadata.orderId);
        await db
          .update(orders)
          .set({
            paymentStatus: "failed",
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, transaction.metadata.orderId));
      }

      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.reference, txRef));

      console.log(`Payment failed for transaction: ${transaction.id}`);
    }

    return NextResponse.json(
      { message: "Webhook processed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
