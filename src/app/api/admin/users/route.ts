import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores } from "@/db/schema";
import { count, eq, desc, ilike, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const role = url.searchParams.get("role") || "all";
    const status = url.searchParams.get("status") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const filters = [];
    if (search) filters.push(ilike(users.fullName, `%${search}%`));
    if (role !== "all") filters.push(eq(users.role, role));
    if (status === "active") filters.push(eq(users.isActive, true));
    if (status === "suspended") filters.push(eq(users.isActive, false));
    const where = filters.length ? and(...filters) : undefined;

    const query = db.select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      isEmailVerified: users.isEmailVerified,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users);

    const allUsers = await query.where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset);

    const storeRows = await db.select({ userId: stores.userId, total: count() }).from(stores).groupBy(stores.userId);
    const storeCountByUser = new Map<string, number>();
    for (const row of storeRows) {
      storeCountByUser.set(row.userId, row.total);
    }

    const result = allUsers.map((u) => ({
      ...u,
      storeCount: storeCountByUser.get(u.id) ?? 0,
      status: u.role === "suspended" ? "suspended" : "active",
    }));

    const totalAgg = await db.select({ total: count() }).from(users).where(where);

    return NextResponse.json({
      users: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
