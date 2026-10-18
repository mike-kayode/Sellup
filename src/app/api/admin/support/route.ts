import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { supportTickets, stores, users } from "@/db/schema";
import { eq, desc, count, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const priority = url.searchParams.get("priority") || "all";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = db.select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      storeId: supportTickets.storeId,
      userId: supportTickets.userId,
    }).from(supportTickets);

    const totalAgg = await db.select({ total: count() }).from(supportTickets);
    const ticketList = await query.orderBy(desc(supportTickets.createdAt)).limit(limit).offset(offset);

    const storeIds = Array.from(new Set(ticketList.map((t) => t.storeId)));
    const userIds = Array.from(new Set(ticketList.map((t) => t.userId)));

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

    const result = ticketList.map((ticket) => {
      const store = storeMap.get(ticket.storeId);
      const user = userMap.get(ticket.userId);
      return {
        ...ticket,
        storeName: store?.storeName || "Unknown",
        userName: user?.fullName || user?.email || "Unknown",
      };
    });

    return NextResponse.json({
      tickets: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin support error:", error);
    return NextResponse.json({ error: "Failed to load support tickets" }, { status: 500 });
  }
}
