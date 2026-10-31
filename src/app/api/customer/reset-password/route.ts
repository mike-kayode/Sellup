import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  consumeCustomerToken,
  revokeCustomerSessions,
  hashCustomerPassword,
} from "@/lib/customer-auth";

const resetSchema = z.object({
  storeSlug: z.string().min(1),
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-reset-password:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug, email, token, password } = resetSchema.parse(body);
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

    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.storeId, storeId), eq(customers.email, normalizedEmail))
      )
      .limit(1);
    if (!customer) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    const ok = await consumeCustomerToken({
      storeId,
      customerId: customer.id,
      type: "password_reset",
      token,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Set new password and revoke ALL existing sessions (security requirement).
    await db
      .update(customers)
      .set({
        passwordHash: await hashCustomerPassword(password),
        isEmailVerified: true,
      })
      .where(eq(customers.id, customer.id));
    await revokeCustomerSessions(storeId, customer.id);

    return NextResponse.json({
      message: "Password reset successfully. Please log in again.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
