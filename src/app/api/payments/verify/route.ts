import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  verifyPayment,
  PaymentProvider,
  validatePaystackWebhookSignature,
  validateFlutterwaveWebhookSignature,
} from "@/lib/payment";

const verifyPaymentSchema = z.object({
  reference: z.string(),
  provider: z.enum(["paystack", "flutterwave"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const reference = request.nextUrl.searchParams.get("reference");
    const provider = request.nextUrl.searchParams.get("provider") || "paystack";

    if (!reference) {
      return NextResponse.json(
        { error: "Reference is required" },
        { status: 400 }
      );
    }

    const paymentProvider = provider as PaymentProvider;
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

    // Verify payment
    const verifyResponse = await verifyPayment(
      paymentProvider,
      paymentConfig,
      reference
    );

    if (!verifyResponse.success) {
      return NextResponse.json(
        { error: "Payment verification failed", status: verifyResponse.status },
        { status: 400 }
      );
    }

    // Extract order ID from reference or metadata
    const orderId = reference.includes("-")
      ? reference.split("-")[2]
      : reference;

    // Update order status if payment successful
    if (verifyResponse.success) {
      await db
        .update(orders)
        .set({
          paymentStatus: "paid",
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    return NextResponse.json(
      {
        message: "Payment verified successfully",
        status: verifyResponse.status,
        amount: verifyResponse.amount,
        reference: verifyResponse.reference,
        customer: verifyResponse.customer,
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

    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = verifyPaymentSchema.parse(body);

    const paymentProvider = validatedData.provider || "paystack";
    const paymentConfig = {
      provider: paymentProvider as PaymentProvider,
      publicKey: process.env.NEXT_PUBLIC_PAYMENT_PUBLIC_KEY || "",
      secretKey: process.env.PAYMENT_SECRET_KEY || "",
    };

    if (!paymentConfig.secretKey) {
      return NextResponse.json(
        { error: "Payment service not configured" },
        { status: 500 }
      );
    }

    // Verify payment
    const verifyResponse = await verifyPayment(
      paymentProvider as PaymentProvider,
      paymentConfig,
      validatedData.reference
    );

    if (!verifyResponse.success) {
      return NextResponse.json(
        { error: "Payment verification failed", status: verifyResponse.status },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "Payment verified successfully",
        status: verifyResponse.status,
        amount: verifyResponse.amount,
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

    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
