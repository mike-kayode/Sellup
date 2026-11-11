import { and, count, desc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  auditLogs,
  businesses,
  platformPromotionRedemptions,
  platformPromotions,
  plans,
} from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const money = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const promotionSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_-]+$/).transform((value) => value.toUpperCase()),
  description: z.string().trim().max(2_000).nullable().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: money,
  maxUsage: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().default(1),
  minOrderAmount: money.nullable().optional(),
  maxDiscount: money.nullable().optional(),
  targetPlan: z.string().trim().min(1).max(50).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  isActive: z.boolean().default(true),
}).strict().refine((value) =>
  Number(value.discountValue) > 0 &&
  (value.discountType !== "percentage" || Number(value.discountValue) <= 100), {
  message: "Discount must be positive, and percentage discounts cannot exceed 100",
  path: ["discountValue"],
}).refine((value) =>
  !value.startsAt || !value.expiresAt || new Date(value.expiresAt) > new Date(value.startsAt), {
  message: "Expiry must be after the start time",
  path: ["expiresAt"],
});

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const isActive = url.searchParams.get("isActive") || "all";
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const filters = [];
    if (isActive === "true") filters.push(eq(platformPromotions.isActive, true));
    if (isActive === "false") filters.push(eq(platformPromotions.isActive, false));
    if (search) filters.push(ilike(platformPromotions.code, `%${search}%`));
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, rows, redemptionCount, redemptionRows] = await Promise.all([
      db.select({ total: count() }).from(platformPromotions).where(where),
      db.select().from(platformPromotions).where(where)
        .orderBy(desc(platformPromotions.createdAt), desc(platformPromotions.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ total: count() }).from(platformPromotionRedemptions),
      db.select({
        id: platformPromotionRedemptions.id,
        promotionId: platformPromotionRedemptions.promotionId,
        code: platformPromotions.code,
        storeId: platformPromotionRedemptions.storeId,
        storeName: businesses.storeName,
        discountAmount: platformPromotionRedemptions.discountAmount,
        status: platformPromotionRedemptions.status,
        reservedAt: platformPromotionRedemptions.reservedAt,
        redeemedAt: platformPromotionRedemptions.redeemedAt,
      }).from(platformPromotionRedemptions)
        .innerJoin(platformPromotions, eq(platformPromotionRedemptions.promotionId, platformPromotions.id))
        .leftJoin(businesses, eq(platformPromotionRedemptions.storeId, businesses.id))
        .orderBy(desc(platformPromotionRedemptions.reservedAt), desc(platformPromotionRedemptions.id))
        .limit(50),
    ]);
    return NextResponse.json({
      promotions: rows,
      total: totalResult[0]?.total ?? 0,
      redemptions: redemptionRows,
      redemptionTotal: redemptionCount[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (cause) {
    console.error("Admin promotions list failed:", cause);
    return NextResponse.json({ error: "Failed to load promotions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = promotionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid promotion", details: parsed.error.flatten() }, { status: 400 });
  try {
    if (parsed.data.targetPlan) {
      const [targetPlan] = await db.select({ slug: plans.slug }).from(plans)
        .where(eq(plans.slug, parsed.data.targetPlan)).limit(1);
      if (!targetPlan) return NextResponse.json({ error: "Target plan not found" }, { status: 400 });
    }
    const { ipAddress, userAgent } = getClientInfo(request);
    const promotion = await db.transaction(async (tx) => {
      const [created] = await tx.insert(platformPromotions).values({
        ...parsed.data,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        currentUsage: 0,
      }).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "promotion.created",
        resourceType: "promotion",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ promotion }, { status: 201 });
  } catch (cause) {
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") {
      return NextResponse.json({ error: "Promotion code already exists" }, { status: 409 });
    }
    console.error("Admin promotion create failed:", cause);
    return NextResponse.json({ error: "Failed to create promotion" }, { status: 500 });
  }
}
