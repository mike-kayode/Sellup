import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, orders, customers, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const updateOrderSchema = z
  .object({
    status: z
      .enum([
        "pending",
        "confirmed",
        "processing",
        "preparing",
        "ready",
        "completed",
        "cancelled",
      ])
      .optional(),
    notes: z.string().max(2000).nullable().optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((body, context) => {
    if (body.status === undefined && body.notes === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one order field must be provided",
      });
    }
    if (body.status !== undefined && !body.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "A reason is required when changing order status",
      });
    }
  });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const [customer] = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        deliveryAddress: customers.deliveryAddress,
      })
      .from(customers)
      .where(eq(customers.id, order.customerId))
      .limit(1);
    const [store] = await db
      .select({
        id: stores.id,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
        currency: stores.currency,
      })
      .from(stores)
      .where(eq(stores.id, order.storeId))
      .limit(1);
    const items = Array.isArray(order.items) ? order.items : [];

    return NextResponse.json({
      order,
      customer,
      store,
      items,
    });
  } catch (error) {
    console.error("Admin order detail error:", error);
    return NextResponse.json({ error: "Failed to load order details" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid order update", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updates: { status?: string; notes?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

    const { ipAddress, userAgent } = getClientInfo(request);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(orders)
        .set(updates)
        .where(eq(orders.id, id))
        .returning();

      if (!row) {
        throw new Error("Order not found during update");
      }

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "order.updated",
        resourceType: "order",
        resourceId: id,
        storeId: existing.storeId,
        previousValue: { status: existing.status, notes: existing.notes },
        newValue: {
          status: row.status,
          notes: row.notes,
          reason: parsed.data.reason ?? null,
        },
        ipAddress,
        userAgent,
      });

      return row;
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Admin order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
