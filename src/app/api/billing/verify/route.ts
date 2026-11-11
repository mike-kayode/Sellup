import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payments,
  stores,
  subscriptions,
  auditLogs,
  platformPromotionRedemptions,
  platformPromotions,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getPlan } from "@/lib/subscriptions";
import { normalizePlan } from "@/lib/entitlements";
import { PaymentProvider, verifyPayment } from "@/lib/payment";
import { decimalToMinorUnits } from "@/lib/admin-payments";

const verifySchema = z.object({
  reference: z.string().min(8).max(255),
  provider: z.enum(["paystack", "flutterwave"]).default("paystack"),
});

export async function GET(request: NextRequest) {
  try {
    const input = verifySchema.parse({
      reference: request.nextUrl.searchParams.get("reference"),
      provider: request.nextUrl.searchParams.get("provider") || "paystack",
    });
    const paymentProvider = input.provider as PaymentProvider;
    const secretKey = paymentProvider === PaymentProvider.PAYSTACK
      ? process.env.PAYSTACK_SECRET_KEY
      : process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ error: "Payment service not configured" }, { status: 503 });

    const [payment] = await db.select().from(payments)
      .where(eq(payments.reference, input.reference))
      .limit(1);
    if (!payment) return NextResponse.json({ error: "Payment reference not found" }, { status: 404 });
    if (payment.gateway !== input.provider) {
      return NextResponse.json({ error: "Payment provider does not match the transaction" }, { status: 400 });
    }
    if (payment.status !== "pending" && payment.status !== "success") {
      return NextResponse.json({ error: "Payment is not pending" }, { status: 409 });
    }

    const metadata = (payment.metadata || {}) as { type?: string; plan?: string; interval?: string };
    if (metadata.type !== "subscription" || !metadata.plan) {
      return NextResponse.json({ error: "Invalid subscription payment" }, { status: 400 });
    }
    if (payment.status === "success") {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        plan: getPlan(normalizePlan(metadata.plan)),
        reference: input.reference,
      });
    }

    const result = await verifyPayment(paymentProvider, {
      provider: paymentProvider,
      publicKey: "",
      secretKey,
    }, input.reference);
    const expectedAmount = decimalToMinorUnits(payment.amount);
    if (expectedAmount === null || !result.success || result.status !== "success" || result.amount !== expectedAmount) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const plan = normalizePlan(metadata.plan);
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (metadata.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const processed = await db.transaction(async (tx) => {
      const [subscriptionBefore] = await tx.select({
        status: subscriptions.status,
        plan: subscriptions.plan,
        dunningAttempts: subscriptions.dunningAttempts,
      }).from(subscriptions).where(eq(subscriptions.storeId, payment.storeId)).limit(1);
      const [paidPayment] = await tx.update(payments)
        .set({ status: "success", paidAt: periodStart })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
        .returning({ id: payments.id });
      if (!paidPayment) return false;
      await tx.update(subscriptions).set({
        plan,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gateway: input.provider,
        gatewaySubscriptionId: input.reference,
        dunningAttempts: 0,
        dunningNextAttemptAt: null,
        dunningLockedAt: null,
        dunningLastError: null,
        updatedAt: periodStart,
      }).where(eq(subscriptions.storeId, payment.storeId));
      await tx.update(stores).set({ plan, updatedAt: periodStart }).where(eq(stores.id, payment.storeId));
      await tx.insert(auditLogs).values({
        actorId: payment.userId,
        actorRole: "merchant",
        action: "subscription.payment_verified",
        resourceType: "subscription",
        storeId: payment.storeId,
        previousValue: subscriptionBefore ?? null,
        newValue: {
          status: "active",
          plan,
          paymentReference: input.reference,
          gateway: input.provider,
        },
      });
      const [redemption] = await tx.select({
        id: platformPromotionRedemptions.id,
        promotionId: platformPromotionRedemptions.promotionId,
      }).from(platformPromotionRedemptions)
        .where(and(
          eq(platformPromotionRedemptions.paymentId, payment.id),
          eq(platformPromotionRedemptions.status, "pending"),
        ))
        .for("update")
        .limit(1);
      if (redemption) {
        await tx.update(platformPromotionRedemptions).set({
          status: "redeemed",
          redeemedAt: periodStart,
        }).where(eq(platformPromotionRedemptions.id, redemption.id));
        await tx.update(platformPromotions).set({
          currentUsage: sql`coalesce(${platformPromotions.currentUsage}, 0) + 1`,
          updatedAt: periodStart,
        }).where(eq(platformPromotions.id, redemption.promotionId));
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      alreadyProcessed: !processed,
      plan: getPlan(plan),
      reference: input.reference,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid payment reference" }, { status: 400 });
    console.error("Subscription verification error:", error);
    return NextResponse.json({ error: "Failed to verify subscription payment" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Use GET method" }, { status: 405 });
}