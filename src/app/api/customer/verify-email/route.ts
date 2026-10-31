import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { consumeCustomerToken } from "@/lib/customer-auth";

const verifySchema = z.object({
  storeSlug: z.string().min(1),
  email: z.string().email(),
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-verify-email:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug, email, token } = verifySchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const [store] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const storeId = store.id;

    // Tenant-scoped customer lookup.
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.storeId, storeId), eq(customers.email, normalizedEmail))
      )
      .limit(1);
    if (!customer) {
      // Generic response — do not leak whether the email exists.
      return NextResponse.json({
        message: "If the email is registered, it is now verified.",
      });
    }

    const ok = await consumeCustomerToken({
      storeId,
      customerId: customer.id,
      type: "email_verify",
      token,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    await db
      .update(customers)
      .set({ isEmailVerified: true })
      .where(eq(customers.id, customer.id));

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer email verify error:", error);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
