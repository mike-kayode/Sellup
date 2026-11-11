import { count, desc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { aiQuotas, auditLogs, businesses } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const quotaSchema = z.object({
  storeId: z.string().uuid(),
  monthlyTokenLimit: z.number().int().min(0).max(1_000_000_000),
  monthlyCostCap: z.string().regex(/^\d{1,8}(?:\.\d{1,4})?$/),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const where = search ? ilike(businesses.storeName, `%${search}%`) : undefined;
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(businesses).where(where),
      db.select({
        id: aiQuotas.id,
        storeId: businesses.id,
        storeName: businesses.storeName,
        monthlyTokenLimit: aiQuotas.monthlyTokenLimit,
        monthlyCostCap: aiQuotas.monthlyCostCap,
        tokensUsedThisMonth: aiQuotas.tokensUsedThisMonth,
        costUsedThisMonth: aiQuotas.costUsedThisMonth,
        monthStart: aiQuotas.monthStart,
        updatedAt: aiQuotas.updatedAt,
      }).from(businesses).leftJoin(aiQuotas, eq(aiQuotas.storeId, businesses.id))
        .where(where).orderBy(desc(aiQuotas.updatedAt), desc(aiQuotas.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ quotas: rows, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (cause) {
    console.error("AI quota list failed:", cause);
    return NextResponse.json({ error: "Failed to load AI quotas" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = quotaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid quota", details: parsed.error.flatten() }, { status: 400 });

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const quota = await db.transaction(async (tx) => {
      const [store] = await tx.select({ id: businesses.id }).from(businesses)
        .where(eq(businesses.id, parsed.data.storeId)).limit(1);
      if (!store) return null;
      const [before] = await tx.select({
        monthlyTokenLimit: aiQuotas.monthlyTokenLimit,
        monthlyCostCap: aiQuotas.monthlyCostCap,
        tokensUsedThisMonth: aiQuotas.tokensUsedThisMonth,
        costUsedThisMonth: aiQuotas.costUsedThisMonth,
      }).from(aiQuotas).where(eq(aiQuotas.storeId, parsed.data.storeId)).limit(1);
      const [after] = await tx.insert(aiQuotas).values({
        storeId: parsed.data.storeId,
        monthlyTokenLimit: parsed.data.monthlyTokenLimit,
        monthlyCostCap: parsed.data.monthlyCostCap,
      }).onConflictDoUpdate({
        target: aiQuotas.storeId,
        set: {
          monthlyTokenLimit: parsed.data.monthlyTokenLimit,
          monthlyCostCap: parsed.data.monthlyCostCap,
          updatedAt: new Date(),
        },
      }).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "ai_quota.updated",
        resourceType: "ai_quota",
        resourceId: after.id,
        storeId: parsed.data.storeId,
        previousValue: before ?? null,
        newValue: {
          monthlyTokenLimit: after.monthlyTokenLimit,
          monthlyCostCap: after.monthlyCostCap,
        },
        ipAddress,
        userAgent,
      });
      return after;
    });
    if (!quota) return NextResponse.json({ error: "Store not found" }, { status: 404 });
    return NextResponse.json({ quota });
  } catch (cause) {
    console.error("AI quota update failed:", cause);
    return NextResponse.json({ error: "Failed to update AI quota" }, { status: 500 });
  }
}
