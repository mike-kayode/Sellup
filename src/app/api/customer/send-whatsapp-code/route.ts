import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, businesses, customerTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/customer-auth";
import { sendWhatsApp } from "@/lib/whatsapp";
import { formatPhoneNumber } from "@/lib/utils";
import { generateVerificationCode } from "@/lib/verification";

const schema = z.object({
  storeSlug: z.string().min(1),
  phone: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-send-whatsapp:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug, phone } = schema.parse(body);
    const normalizedPhone = formatPhoneNumber(phone);

    const [store] = await db
      .select({ id: businesses.id, storeName: businesses.storeName })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const storeId = store.id;

    // Tenant-scoped: buyer must belong to this store. Upsert by phone.
    let [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.storeId, storeId), eq(customers.phone, normalizedPhone))
      )
      .limit(1);
    if (!customer) {
      const [inserted] = await db
        .insert(customers)
        .values({
          storeId,
          phone: normalizedPhone,
          name: "",
          passwordHash: "",
          isEmailVerified: false,
          isWhatsAppVerified: false,
        })
        .returning({ id: customers.id });
      customer = inserted;
    }

    // 6-digit code (user-friendly over WhatsApp). Hash is what gets stored.
    const code = generateVerificationCode();
    await db.insert(customerTokens).values({
      storeId,
      customerId: customer.id,
      type: "whatsapp_verify",
      tokenHash: hashToken(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const message = `Your ${store.storeName} verification code is: ${code}. Valid for 10 minutes.`;
    await sendWhatsApp({ to: normalizedPhone, message }).catch(() => {});

    // Generic response â€” do not leak whether the phone exists.
    return NextResponse.json({
      message: "If a buyer account with that phone exists, a code has been sent.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Send WhatsApp code error:", error);
    return NextResponse.json(
      { error: "Failed to send code" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
