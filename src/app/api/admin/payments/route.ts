import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, stores, users } from "@/db/schema";
import { eq, desc, count, inArray, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const gateway = url.searchParams.get("gateway") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const filters = [];
    if (status !== "all") filters.push(eq(payments.status, status));
    if (gateway !== "all") filters.push(eq(payments.gateway, gateway));
    const where = filters.length ? and(...filters) : undefined;

    const query = db.select({
      id: payments.id,
      amount: payments.amount,
      currency: payments.currency,
      gateway: payments.gateway,
      reference: payments.reference,
      status: payments.status,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      storeId: payments.storeId,
      userId: payments.userId,
    }).from(payments);

    const totalAgg = await db.select({ total: count() }).from(payments).where(where);
    const paymentList = await query.where(where).orderBy(desc(payments.createdAt)).limit(limit).offset(offset);

    const storeIds = Array.from(new Set(paymentList.map((p) => p.storeId)));
    const userIds = Array.from(new Set(paymentList.map((p) => p.userId)));

    const [storeRows, userRows] = await Promise.all([
      storeIds.length
        ? db.select({ id: stores.id, storeName: stores.storeName }).from(stores).where(inArray(stores.id, storeIds))
        : Promise.resolve([]),
      userIds.length
        ? db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(inArray(users.id, userIds))
        : Promise.resolve([]),
    ]);

    const storeMap = new Map(storeRows.map((s) => [s.id, s]));
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    const result = paymentList.map((payment) => {
      const store = storeMap.get(payment.storeId);
      const user = userMap.get(payment.userId);
      return {
        ...payment,
        storeName: store?.storeName || "Unknown",
        userName: user?.fullName || user?.email || "Unknown",
      };
    });

    return NextResponse.json({
      payments: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin payments error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}
