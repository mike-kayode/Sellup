import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { domains, stores } from "@/db/schema";
import { desc, count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const totalAgg = await db.select({ total: count() }).from(domains);
    const list = await db.select({
      id: domains.id,
      storeId: domains.storeId,
      domain: domains.domain,
      status: domains.status,
      createdAt: domains.createdAt,
      storeName: stores.storeName,
      storeSlug: stores.storeSlug,
    }).from(domains).leftJoin(stores, eq(domains.storeId, stores.id)).orderBy(desc(domains.createdAt)).limit(50);

    return NextResponse.json({
      domains: list.map((domain) => ({
        id: domain.id,
        storeName: domain.storeName || "Unknown store",
        storeSlug: domain.storeSlug || "unknown",
        domain: domain.domain,
        status: domain.status,
        createdAt: domain.createdAt,
      })),
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin domains error:", error);
    return NextResponse.json({ error: "Failed to load domains" }, { status: 500 });
  }
}
