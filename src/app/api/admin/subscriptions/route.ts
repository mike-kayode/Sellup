import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions, stores } from "@/db/schema";
import { eq, desc, count, inArray, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const plan = url.searchParams.get("plan") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const filters = [];
    if (status !== "all") filters.push(eq(subscriptions.status, status));
    if (plan !== "all") filters.push(eq(subscriptions.plan, plan));
    const where = filters.length ? and(...filters) : undefined;

    const query = db.select({
      id: subscriptions.id,
      plan: subscriptions.plan,
      status: subscriptions.status,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      gateway: subscriptions.gateway,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      createdAt: subscriptions.createdAt,
      storeId: subscriptions.storeId,
    }).from(subscriptions);

    const totalAgg = await db.select({ total: count() }).from(subscriptions).where(where);
    const subList = await query.where(where).orderBy(desc(subscriptions.createdAt)).limit(limit).offset(offset);

    const storeIds = subList.map((s) => s.storeId);
    const storeRows = storeIds.length
      ? await db.select({ id: stores.id, storeName: stores.storeName, storeSlug: stores.storeSlug }).from(stores).where(inArray(stores.id, storeIds))
      : [];

    const storeMap = new Map(storeRows.map((s) => [s.id, s]));

    const result = subList.map((sub) => {
      const store = storeMap.get(sub.storeId);
      return {
        ...sub,
        storeName: store?.storeName || "Unknown",
        storeSlug: store?.storeSlug || "",
      };
    });

    return NextResponse.json({
      subscriptions: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }
}
