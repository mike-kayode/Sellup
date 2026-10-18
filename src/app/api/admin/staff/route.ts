import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const totalAgg = await db.select({ total: count() }).from(users);
    const list = await db.select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isEmailVerified: users.isEmailVerified,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(50);

    return NextResponse.json({
      staff: list.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        isVerified: u.isEmailVerified,
        createdAt: u.createdAt,
      })),
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin staff error:", error);
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  }
}
