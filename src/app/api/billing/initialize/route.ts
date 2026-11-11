import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  stores,
  payments,
  subscriptions,
  platformPromotions,
  platformPromotionRedemptions,
  plans as platformPlans,
} from "@/db/schema";
import { and, count, eq, gte, or } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/subscriptions";
import { initializePayment, PaymentProvider } from "@/lib/payment";

const initSchema = z.object({
  storeId: z.string().uuid(),
  plan: z.enum(["starter", "business", "pro"]),
  provider: z.enum(["paystack", "flutterwave"]).default("paystack"),
  promotionCode: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()).optional(),
});

/**
 * POST /api/billing/initialize
 * Initialize a subscription payment for a store owned by the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    // Resolve authenticated user
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = initSchema.parse(body);

    // Verify the user owns the store
    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId, email: stores.email })
      .from(stores)
      .where(eq(stores.id, validatedData.storeId))
      .limit(1);

    if (storeResult.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (storeResult[0].userId !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this store" },
        { status: 403 }
      );
    }

    const [configuredPlan] = await db.select().from(platformPlans)
      .where(eq(platformPlans.slug, validatedData.plan)).limit(1);
    if (configuredPlan && !configuredPlan.isActive) {
      return NextResponse.json({ error: "This plan is no longer available" }, { status: 409 });
    }
    const staticPlan = getPlan(validatedData.plan);
    const planPrice = configuredPlan
      ? Number(configuredPlan.interval === "year"
        ? configuredPlan.yearlyPrice ?? configuredPlan.price
        : configuredPlan.price)
      : staticPlan.price;
    if (!Number.isFinite(planPrice) || planPrice < 0) {
      return NextResponse.json({ error: "Plan pricing is invalid" }, { status: 409 });
    }
    const plan = configuredPlan
      ? {
          ...staticPlan,
          id: validatedData.plan,
          name: configuredPlan.name,
          price: planPrice,
          tagline: configuredPlan.description || staticPlan.tagline,
          features: Array.isArray(configuredPlan.features)
            ? configuredPlan.features.filter((feature): feature is string => typeof feature === "string")
            : staticPlan.features,
          limits: {
            products: configuredPlan.productLimit ?? staticPlan.limits.products,
            staffMembers: configuredPlan.staffLimit ?? staticPlan.limits.staffMembers,
          },
        }
      : staticPlan;
    const now = new Date();
    const reservationCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let promotion: typeof platformPromotions.$inferSelect | undefined;
    let discountMinor = 0;
    const baseMinor = Math.round(Number(plan.price) * 100);
    if (validatedData.promotionCode) {
      [promotion] = await db.select().from(platformPromotions)
        .where(eq(platformPromotions.code, validatedData.promotionCode))
        .limit(1);
      if (!promotion || !promotion.isActive ||
        (promotion.startsAt && promotion.startsAt > now) ||
        (promotion.expiresAt && promotion.expiresAt < now) ||
        (promotion.targetPlan && promotion.targetPlan !== validatedData.plan) ||
        (promotion.minOrderAmount && Number(promotion.minOrderAmount) > Number(plan.price))) {
        return NextResponse.json({ error: "Promotion code is invalid or unavailable" }, { status: 400 });
      }
      const currentUsage = promotion.currentUsage ?? 0;
      if (promotion.maxUsage !== null && promotion.maxUsage !== undefined && currentUsage >= promotion.maxUsage) {
        return NextResponse.json({ error: "Promotion usage limit has been reached" }, { status: 409 });
      }

      const redeemedForStore = await db.select({ total: count() })
        .from(platformPromotionRedemptions)
        .where(and(
          eq(platformPromotionRedemptions.promotionId, promotion.id),
          eq(platformPromotionRedemptions.storeId, validatedData.storeId),
          or(
            eq(platformPromotionRedemptions.status, "redeemed"),
            and(
              eq(platformPromotionRedemptions.status, "pending"),
              gte(platformPromotionRedemptions.reservedAt, reservationCutoff),
            ),
          ),
        ));
      if ((redeemedForStore[0]?.total ?? 0) >= (promotion.perCustomerLimit ?? 1)) {
        return NextResponse.json({ error: "Promotion usage limit for this store has been reached" }, { status: 409 });
      }

      const activeReservations = await db.select({ total: count() })
        .from(platformPromotionRedemptions)
        .where(and(
          eq(platformPromotionRedemptions.promotionId, promotion.id),
          or(
            eq(platformPromotionRedemptions.status, "redeemed"),
            and(
              eq(platformPromotionRedemptions.status, "pending"),
              gte(platformPromotionRedemptions.reservedAt, reservationCutoff),
            ),
          ),
        ));
      if (promotion.maxUsage !== null && promotion.maxUsage !== undefined &&
        (activeReservations[0]?.total ?? 0) >= promotion.maxUsage) {
        return NextResponse.json({ error: "Promotion usage limit has been reached" }, { status: 409 });
      }

      if (promotion.discountType === "percentage") {
        const percentage = Number(promotion.discountValue);
        if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
          return NextResponse.json({ error: "Promotion configuration is invalid" }, { status: 409 });
        }
        discountMinor = Math.floor((baseMinor * percentage) / 100);
      } else if (promotion.discountType === "fixed") {
        discountMinor = Math.round(Number(promotion.discountValue) * 100);
      } else {
        return NextResponse.json({ error: "Promotion configuration is invalid" }, { status: 409 });
      }
      if (promotion.maxDiscount) {
        discountMinor = Math.min(discountMinor, Math.round(Number(promotion.maxDiscount) * 100));
      }
      discountMinor = Math.min(discountMinor, baseMinor);
      if (baseMinor - discountMinor <= 0) {
        return NextResponse.json({ error: "Promotion cannot reduce subscription price to zero" }, { status: 400 });
      }
    }
    const payableMinor = baseMinor - discountMinor;
    const secretKey =
      validatedData.provider === "paystack"
        ? process.env.PAYSTACK_SECRET_KEY
        : process.env.FLUTTERWAVE_SECRET_KEY;
    const publicKey =
      validatedData.provider === "paystack"
        ? process.env.PAYSTACK_PUBLIC_KEY
        : process.env.FLUTTERWAVE_PUBLIC_KEY;

    // If no payment keys configured, return a "manual" fallback response
    if (!secretKey || !publicKey) {
      return NextResponse.json(
        {
          canPay: false,
          message: "Online payments are not configured yet. Please contact support.",
          plan,
        },
        { status: 200 }
      );
    }

    const email = storeResult[0].email || user.email || "";
    const reference = `SUB-${validatedData.storeId.slice(0, 8)}-${Date.now()}`;
    const result = await initializePayment(
      validatedData.provider as PaymentProvider,
      {
        provider: validatedData.provider as PaymentProvider,
        publicKey,
        secretKey,
      },
      {
        email,
        amount: payableMinor,
        orderId: reference,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/onboarding?payment=success&reference=${encodeURIComponent(reference)}&storeId=${encodeURIComponent(validatedData.storeId)}`,
        metadata: {
          storeId: validatedData.storeId,
          plan: validatedData.plan,
          interval: configuredPlan?.interval === "year" ? "year" : "month",
          promotionCode: promotion?.code ?? null,
        },
      }
    );

    if (!result.success || !result.reference) {
      return NextResponse.json(
        { canPay: false, message: result.message || "Payment initialization failed" },
        { status: 502 }
      );
    }

    const authenticatedUser = user;
    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.transaction(async (tx) => {
      let lockedPromotion: typeof platformPromotions.$inferSelect | undefined;
      if (promotion) {
        [lockedPromotion] = await tx.select().from(platformPromotions)
          .where(eq(platformPromotions.id, promotion.id))
          .for("update")
          .limit(1);
        const lockedUsage = lockedPromotion
          ? await tx.select({ total: count() }).from(platformPromotionRedemptions)
            .where(and(
              eq(platformPromotionRedemptions.promotionId, promotion.id),
              or(
                eq(platformPromotionRedemptions.status, "redeemed"),
                and(
                  eq(platformPromotionRedemptions.status, "pending"),
                  gte(platformPromotionRedemptions.reservedAt, reservationCutoff),
                ),
              ),
            ))
          : [];
        if (!lockedPromotion || !lockedPromotion.isActive ||
          (lockedPromotion.startsAt && lockedPromotion.startsAt > now) ||
          (lockedPromotion.expiresAt && lockedPromotion.expiresAt < now) ||
          (lockedPromotion.maxUsage !== null && lockedPromotion.maxUsage !== undefined &&
            (lockedUsage[0]?.total ?? 0) >= lockedPromotion.maxUsage)) {
          throw new Error("PROMOTION_UNAVAILABLE");
        }
      }
      await tx.update(subscriptions).set({
        plan: validatedData.plan,
        status: "pending",
        gateway: validatedData.provider,
        gatewaySubscriptionId: result.reference,
        updatedAt: new Date(),
      }).where(eq(subscriptions.storeId, validatedData.storeId));

      await tx.insert(payments).values({
        storeId: validatedData.storeId,
        userId: authenticatedUser.id,
        amount: (payableMinor / 100).toFixed(2),
        currency: "NGN",
        gateway: validatedData.provider,
        reference: result.reference,
        status: "pending",
        metadata: {
          type: "subscription",
          plan: validatedData.plan,
          interval: configuredPlan?.interval === "year" ? "year" : "month",
          baseAmount: (baseMinor / 100).toFixed(2),
          promotionId: promotion?.id ?? null,
          promotionCode: promotion?.code ?? null,
          discountAmount: (discountMinor / 100).toFixed(2),
        },
      } as any);
      if (lockedPromotion) {
        const [createdPayment] = await tx.select({ id: payments.id })
          .from(payments)
          .where(eq(payments.reference, result.reference!))
          .limit(1);
        if (!createdPayment) throw new Error("PAYMENT_RECORD_MISSING");
        const storeUseCount = await tx.select({ total: count() })
          .from(platformPromotionRedemptions)
          .where(and(
            eq(platformPromotionRedemptions.promotionId, lockedPromotion.id),
            eq(platformPromotionRedemptions.storeId, validatedData.storeId),
            or(
              eq(platformPromotionRedemptions.status, "redeemed"),
              and(
                eq(platformPromotionRedemptions.status, "pending"),
                gte(platformPromotionRedemptions.reservedAt, reservationCutoff),
              ),
            ),
          ));
        if ((storeUseCount[0]?.total ?? 0) >= (lockedPromotion.perCustomerLimit ?? 1)) {
          throw new Error("PROMOTION_UNAVAILABLE");
        }
        await tx.insert(platformPromotionRedemptions).values({
          promotionId: lockedPromotion.id,
          paymentId: createdPayment.id,
          storeId: validatedData.storeId,
          discountAmount: (discountMinor / 100).toFixed(2),
          status: "pending",
        });
      }
    });

    return NextResponse.json(
      {
        canPay: true,
        result,
        plan: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "PROMOTION_UNAVAILABLE") {
      return NextResponse.json({ error: "Promotion is no longer available. Please retry without it." }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Billing initialize error:", error);
    return NextResponse.json(
      { error: "Failed to initialize payment" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
