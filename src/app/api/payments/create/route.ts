import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isPaidPlan, normalizePlan } from "@/lib/entitlements";
import {
  initializePayment,
  PaymentProvider,
  formatAmountToKobo,
} from "@/lib/payment";

const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(["paystack", "flutterwave"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createPaymentSchema.parse(body);

    // Get order details
    const order = await db
      .select()
      .from(orders)
      .where(eq(orders.id, validatedData.orderId))
      .limit(1);

    if (order.length === 0) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const orderData = order[0];
    const totalAmount = parseFloat(orderData.total);

    // Online payments (Paystack/Flutterwave) are a paid-plan perk — freemium
    // stores can only take WhatsApp orders.
    const [orderStore] = await db
      .select({ plan: stores.plan })
      .from(stores)
      .where(eq(stores.id, orderData.storeId))
      .limit(1);
    if (!isPaidPlan(normalizePlan(orderStore?.plan))) {
      return NextResponse.json(
        {
          error:
            "Online payments require a paid plan. Upgrade to accept card payments.",
        },
        { status: 403 }
      );
    }

    // Initialize payment
    const paymentProvider = validatedData.provider as PaymentProvider;
    const paymentConfig = {
      provider: paymentProvider,
      publicKey: process.env.NEXT_PUBLIC_PAYMENT_PUBLIC_KEY || "",
      secretKey: process.env.PAYMENT_SECRET_KEY || "",
    };

    if (!paymentConfig.secretKey) {
      return NextResponse.json(
        { error: "Payment service not configured" },
        { status: 500 }
      );
    }

    const paymentResponse = await initializePayment(
      paymentProvider,
      paymentConfig,
      {
        email: "customer@example.com", // Get from order details
        amount: formatAmountToKobo(totalAmount),
        orderId: validatedData.orderId,
        metadata: {
          orderId: validatedData.orderId,
          orderNumber: orderData.orderNumber,
        },
      }
    );

    if (!paymentResponse.success) {
      return NextResponse.json(
        { error: paymentResponse.message || "Payment initialization failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "Payment initialized successfully",
        paymentUrl: paymentResponse.authorizationUrl,
        reference: paymentResponse.reference,
        provider: paymentProvider,
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

    console.error("Payment initialization error:", error);
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
