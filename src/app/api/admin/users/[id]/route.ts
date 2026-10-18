import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, orders, payments } from "@/db/schema";
import { eq, desc, count, inArray, sum } from "drizzle-orm";
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

    const [targetUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userStores = await db.select().from(stores).where(eq(stores.userId, id));
    const storeIds = userStores.map((store) => store.id);
    const userOrders = storeIds.length
      ? await db.select().from(orders).where(inArray(orders.storeId, storeIds)).orderBy(desc(orders.createdAt)).limit(20)
      : [];
    const userPayments = await db.select().from(payments).where(eq(payments.userId, id)).orderBy(desc(payments.createdAt)).limit(20);
    const totalSpent = await db.select({ total: sum(payments.amount) }).from(payments).where(eq(payments.userId, id));

    return NextResponse.json({
      user: targetUser,
      stores: userStores,
      orders: userOrders,
      payments: userPayments,
      stats: {
        stores: userStores.length,
        orders: userOrders.length,
        totalSpent: Number(totalSpent[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Failed to load user details" }, { status: 500 });
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

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const previousValue = { role: existing.role, isEmailVerified: existing.isEmailVerified };

    const [updated] = await db.update(users).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(users.id, id)).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "user.updated",
        resourceType: "user",
        resourceId: id,
        previousValue,
        newValue: { role: updated?.role, isEmailVerified: updated?.isEmailVerified },
        ...clientInfo,
      });
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
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

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.delete(users).where(eq(users.id, id));

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "user.deleted",
        resourceType: "user",
        resourceId: id,
        previousValue: { email: existing.email, fullName: existing.fullName },
        ...clientInfo,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
