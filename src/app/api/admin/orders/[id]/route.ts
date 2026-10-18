import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, customers, stores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
    const [store] = await db.select().from(stores).where(eq(stores.id, order.storeId)).limit(1);
    const items = order.items as any[] || [];

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

    const { id } = await context.params;
    const body = await request.json();

    const [existing] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const [updated] = await db.update(orders).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Admin order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
