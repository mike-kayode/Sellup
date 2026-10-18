import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stores, customers } from "@/db/schema";
import { eq, desc, inArray, ilike, and, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "all";
    const storeId = url.searchParams.get("storeId") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const filters = [];
    if (search) filters.push(ilike(orders.orderNumber, `%${search}%`));
    if (status !== "all") filters.push(eq(orders.status, status));
    if (storeId) filters.push(eq(orders.storeId, storeId));
    const where = filters.length ? and(...filters) : undefined;

    const query = db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      storeId: orders.storeId,
      customerId: orders.customerId,
      total: orders.total,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    }).from(orders);

    const totalAgg = await db.select({ total: count() }).from(orders).where(where);
    const orderList = await query.where(where).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);

    const storeIds = Array.from(new Set(orderList.map((o) => o.storeId)));
    const customerIds = Array.from(new Set(orderList.map((o) => o.customerId)));

    const [storeRows, customerRows] = await Promise.all([
      storeIds.length
        ? db.select({ id: stores.id, storeName: stores.storeName, storeSlug: stores.storeSlug }).from(stores).where(inArray(stores.id, storeIds))
        : Promise.resolve([]),
      customerIds.length
        ? db.select({ id: customers.id, name: customers.name, phone: customers.phone }).from(customers).where(inArray(customers.id, customerIds))
        : Promise.resolve([]),
    ]);

    const storeMap = new Map(storeRows.map((s) => [s.id, s]));
    const customerMap = new Map(customerRows.map((c) => [c.id, c]));

    const result = orderList.map((order) => {
      const store = storeMap.get(order.storeId);
      const customer = customerMap.get(order.customerId);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        storeName: store?.storeName || "Unknown",
        storeSlug: store?.storeSlug || "",
        customerName: customer?.name || "Unknown",
        customerPhone: customer?.phone || "",
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      };
    });

    return NextResponse.json({
      orders: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin orders error:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
