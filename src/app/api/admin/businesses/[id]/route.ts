import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, users, orders, products, subscriptions, staffMembers } from "@/db/schema";
import { eq, desc, count, sum } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;

    const [store] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!store) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const [owner] = await db.select().from(users).where(eq(users.id, store.userId)).limit(1);

    const storeOrders = await db.select({ total: count() }).from(orders).where(eq(orders.storeId, id));
    const storeRevenue = await db.select({ total: sum(orders.total) }).from(orders).where(eq(orders.storeId, id));
    const storeProducts = await db.select({ total: count() }).from(products).where(eq(products.storeId, id));
    const storeStaff = await db.select().from(staffMembers).where(eq(staffMembers.storeId, id));
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.storeId, id)).limit(1);

    const recentOrders = await db.select().from(orders).where(eq(orders.storeId, id)).orderBy(desc(orders.createdAt)).limit(10);
    const recentProducts = await db.select().from(products).where(eq(products.storeId, id)).orderBy(desc(products.createdAt)).limit(10);

    return NextResponse.json({
      business: store,
      owner,
      stats: {
        orders: storeOrders[0]?.total ?? 0,
        products: storeProducts[0]?.total ?? 0,
        staff: storeStaff.length,
        revenue: Number(storeRevenue[0]?.total || 0),
      },
      subscription,
      staff: storeStaff,
      recentOrders,
      recentProducts,
    });
  } catch (error) {
    console.error("Admin business detail error:", error);
    return NextResponse.json({ error: "Failed to load business details" }, { status: 500 });
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

    const [existing] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const previousValue = { isPublished: existing.isPublished, plan: existing.plan };

    const [updated] = await db.update(stores).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(stores.id, id)).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "business.updated",
        resourceType: "business",
        resourceId: id,
        previousValue,
        newValue: { isPublished: updated?.isPublished, plan: updated?.plan },
        ...clientInfo,
      });
    }

    return NextResponse.json({ business: updated });
  } catch (error) {
    console.error("Admin business update error:", error);
    return NextResponse.json({ error: "Failed to update business" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;

    const [existing] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    await db.delete(stores).where(eq(stores.id, id));

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "business.deleted",
        resourceType: "business",
        resourceId: id,
        previousValue: { storeName: existing.storeName, storeSlug: existing.storeSlug },
        ...clientInfo,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin business delete error:", error);
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 });
  }
}
