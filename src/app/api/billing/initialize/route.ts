import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, payments, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/subscriptions";
import { initializePayment, PaymentProvider } from "@/lib/payment";

const initSchema = z.object({
  storeId: z.string().uuid(),
  plan: z.enum(["starter", "business", "pro"]),
  provider: z.enum(["paystack", "flutterwave"]).default("paystack"),
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

    const plan = getPlan(validatedData.plan);
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
        amount: plan.price * 100, // to kobo
        orderId: reference,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/onboarding?payment=success&reference=${encodeURIComponent(reference)}&storeId=${encodeURIComponent(validatedData.storeId)}`,
        metadata: {
          storeId: validatedData.storeId,
          plan: validatedData.plan,
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
        amount: plan.price.toString(),
        currency: "NGN",
        gateway: validatedData.provider,
        reference: result.reference,
        status: "pending",
        metadata: { type: "subscription", plan: validatedData.plan },
      } as any);
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
