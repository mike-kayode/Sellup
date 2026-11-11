import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, platformPromotions, plans } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const updateSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_-]+$/).transform((value) => value.toUpperCase()).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).optional(),
  maxUsage: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().optional(),
  minOrderAmount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).nullable().optional(),
  maxDiscount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).nullable().optional(),
  targetPlan: z.string().trim().min(1).max(50).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid promotion ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid promotion update", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.discountValue !== undefined) {
    const discountType = parsed.data.discountType;
    if (Number(parsed.data.discountValue) <= 0 ||
      (discountType === "percentage" && Number(parsed.data.discountValue) > 100)) {
      return NextResponse.json({ error: "Discount value is invalid" }, { status: 400 });
    }
  }

  try {
    if (parsed.data.targetPlan) {
      const [targetPlan] = await db.select({ slug: plans.slug }).from(plans)
        .where(eq(plans.slug, parsed.data.targetPlan)).limit(1);
      if (!targetPlan) return NextResponse.json({ error: "Target plan not found" }, { status: 400 });
    }
    const { startsAt, expiresAt, ...fields } = parsed.data;
    const updates = {
      ...fields,
      ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      updatedAt: new Date(),
    };
    const { ipAddress, userAgent } = getClientInfo(request);
    const promotion = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(platformPromotions)
        .where(eq(platformPromotions.id, id)).for("update").limit(1);
      if (!before) return null;
      const effectiveDiscountType = parsed.data.discountType ?? before.discountType;
      const effectiveDiscountValue = Number(parsed.data.discountValue ?? before.discountValue);
      if (!Number.isFinite(effectiveDiscountValue) || effectiveDiscountValue <= 0 ||
        (effectiveDiscountType === "percentage" && effectiveDiscountValue > 100)) {
        throw new Error("PROMOTION_INVALID_DISCOUNT");
      }
      const effectiveStartsAt = parsed.data.startsAt === undefined
        ? before.startsAt
        : parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
      const effectiveExpiresAt = parsed.data.expiresAt === undefined
        ? before.expiresAt
        : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
      if (effectiveStartsAt && effectiveExpiresAt && effectiveExpiresAt <= effectiveStartsAt) {
        throw new Error("PROMOTION_INVALID_DATES");
      }
      if (parsed.data.maxUsage !== undefined && parsed.data.maxUsage !== null &&
        parsed.data.maxUsage < (before.currentUsage ?? 0)) {
        throw new Error("PROMOTION_MAX_USAGE_BELOW_REDEMPTIONS");
      }
      const [after] = await tx.update(platformPromotions).set(updates)
        .where(eq(platformPromotions.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "promotion.updated",
        resourceType: "promotion",
        resourceId: id,
        previousValue: before,
        newValue: after,
        ipAddress,
        userAgent,
      });
      return after;
    });
    if (!promotion) return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    return NextResponse.json({ promotion });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "PROMOTION_MAX_USAGE_BELOW_REDEMPTIONS") {
      return NextResponse.json({ error: "Max usage cannot be lower than completed redemptions" }, { status: 409 });
    }
    if (cause instanceof Error && cause.message === "PROMOTION_INVALID_DISCOUNT") {
      return NextResponse.json({ error: "Discount configuration is invalid" }, { status: 400 });
    }
    if (cause instanceof Error && cause.message === "PROMOTION_INVALID_DATES") {
      return NextResponse.json({ error: "Expiry must be after the start time" }, { status: 400 });
    }
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") {
      return NextResponse.json({ error: "Promotion code already exists" }, { status: 409 });
    }
    console.error("Admin promotion update failed:", cause);
    return NextResponse.json({ error: "Failed to update promotion" }, { status: 500 });
  }
}
