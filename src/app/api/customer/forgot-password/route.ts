import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { issueCustomerToken } from "@/lib/customer-auth";
import { sendPasswordResetEmail } from "@/lib/email";

const forgotSchema = z.object({
  storeSlug: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-forgot-password:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug, email } = forgotSchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const [store] = await db
      .select({
        id: businesses.id,
        storeName: businesses.storeName,
        storeSlug: businesses.storeSlug,
      })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const storeId = store.id;

    // Tenant-scoped lookup � generic response either way (no account leakage).
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.storeId, storeId), eq(customers.email, normalizedEmail))
      )
      .limit(1);

    if (customer) {
      const token = await issueCustomerToken({
        storeId,
        customerId: customer.id,
        type: "password_reset",
        ttlMs: 60 * 60 * 1000, // 1 hour
      });
      const storeUrl = `https://${store.storeSlug}.sellup.ng`;
      await sendPasswordResetEmail(normalizedEmail, `${storeUrl}/reset-password?token=${token}`).catch(() => {});
    }

    return NextResponse.json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer forgot password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
