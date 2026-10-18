import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, stores, subscriptions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getPlan } from "@/lib/subscriptions";
import { normalizePlan } from "@/lib/entitlements";
import { PaymentProvider, verifyPayment } from "@/lib/payment";

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

    const [pendingPayment] = await db.select().from(payments).where(
      and(eq(payments.reference, input.reference), eq(payments.status, "pending"))
    ).limit(1);
    if (!pendingPayment) return NextResponse.json({ error: "Payment reference not found" }, { status: 404 });

    const result = await verifyPayment(paymentProvider, {
      provider: paymentProvider,
      publicKey: "",
      secretKey,
    }, input.reference);
    const expectedAmount = Math.round(Number(pendingPayment.amount) * 100);
    if (!result.success || result.status !== "success" || result.amount !== expectedAmount) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const metadata = (pendingPayment.metadata || {}) as { type?: string; plan?: string };
    if (metadata.type !== "subscription" || !metadata.plan) {
      return NextResponse.json({ error: "Invalid subscription payment" }, { status: 400 });
    }
    const plan = normalizePlan(metadata.plan);
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.transaction(async (tx) => {
      await tx.update(payments).set({ status: "success", paidAt: periodStart }).where(eq(payments.id, pendingPayment.id));
      await tx.update(subscriptions).set({
        plan,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gateway: input.provider,
        gatewaySubscriptionId: input.reference,
        updatedAt: periodStart,
      }).where(eq(subscriptions.storeId, pendingPayment.storeId));
      await tx.update(stores).set({ plan, updatedAt: periodStart }).where(eq(stores.id, pendingPayment.storeId));
    });

    return NextResponse.json({ success: true, plan: getPlan(plan), reference: input.reference });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid payment reference" }, { status: 400 });
    console.error("Subscription verification error:", error);
    return NextResponse.json({ error: "Failed to verify subscription payment" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Use GET method" }, { status: 405 });
}