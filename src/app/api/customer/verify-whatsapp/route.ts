import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { consumeCustomerToken } from "@/lib/customer-auth";
import { formatPhoneNumber } from "@/lib/utils";

const verifySchema = z.object({
  storeSlug: z.string().min(1),
  phone: z.string().min(6),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-verify-whatsapp:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug, phone, code } = verifySchema.parse(body);
    const normalizedPhone = formatPhoneNumber(phone);

    const [store] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const storeId = store.id;

    // Tenant-scoped customer lookup by phone.
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.storeId, storeId), eq(customers.phone, normalizedPhone))
      )
      .limit(1);
    if (!customer) {
      // Generic response — do not leak whether the phone exists.
      return NextResponse.json({
        message: "If the phone is registered and a code was sent, it is now verified.",
      });
    }

    const ok = await consumeCustomerToken({
      storeId,
      customerId: customer.id,
      type: "whatsapp_verify",
      token: code,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    await db
      .update(customers)
      .set({ isWhatsAppVerified: true })
      .where(eq(customers.id, customer.id));

    return NextResponse.json({ message: "WhatsApp verified successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer WhatsApp verify error:", error);
    return NextResponse.json({ error: "Failed to verify WhatsApp" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
