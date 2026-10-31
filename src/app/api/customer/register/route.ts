import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { hashCustomerPassword } from "@/lib/customer-auth";
import { sendVerificationCodeEmail } from "@/lib/email";
import { sendVerificationCodeSMS } from "@/lib/sms";
import { formatPhoneNumber } from "@/lib/utils";
import { issueCustomerToken } from "@/lib/customer-auth";

const registerSchema = z.object({
  storeSlug: z.string().min(1),
  name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-register:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug, name, email, phone, password } = registerSchema.parse(
      body
    );

    const rawEmail = (email || "").trim().toLowerCase() || null;
    const rawPhone = (phone || "").trim() || null;
    if (!rawEmail && !rawPhone) {
      return NextResponse.json(
        { error: "Email or phone is required" },
        { status: 400 }
      );
    }

    // Derive the store from the slug (validated — never trust a raw store id).
    const [store] = await db
      .select({ id: businesses.id, storeName: businesses.storeName })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const storeId = store.id;

    // Find existing buyer for this store by phone or email (tenant-scoped).
    let existing: { id: string } | null = null;
    if (rawPhone) {
      const formatted = formatPhoneNumber(rawPhone);
      const [row] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.storeId, storeId),
            eq(customers.phone, formatted)
          )
        )
        .limit(1);
      existing = row ?? null;
    }
    if (!existing && rawEmail) {
      const [row] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(eq(customers.storeId, storeId), eq(customers.email, rawEmail))
        )
        .limit(1);
      existing = row ?? null;
    }

    const customerId =
      existing?.id ??
      (
        await db
          .insert(customers)
          .values({
            storeId,
            name,
            phone: rawPhone ?? null,
            email: rawEmail,
            passwordHash: "", // set below if password provided
            isEmailVerified: false,
            isWhatsAppVerified: false,
          })
          .returning({ id: customers.id })
      )[0].id;

    // Set / rotate the password hash (buyer accounts are password-based).
    await db
      .update(customers)
      .set({ passwordHash: await hashCustomerPassword(password) })
      .where(eq(customers.id, customerId));

    // Issue a verification code: email preferred, else WhatsApp/SMS.
    let codeSent = false;
    if (rawEmail) {
      const code = await issueCustomerToken({
        storeId,
        customerId,
        type: "email_verify",
        ttlMs: 10 * 60 * 1000,
      });
      codeSent = await sendVerificationCodeEmail(rawEmail, code, name);
    } else if (rawPhone) {
      const code = await issueCustomerToken({
        storeId,
        customerId,
        type: "whatsapp_verify",
        ttlMs: 10 * 60 * 1000,
      });
      codeSent = await sendVerificationCodeSMS(rawPhone, code);
    }

    // Generic response to avoid leaking account existence.
    return NextResponse.json(
      {
        message:
          "If an account for this store and contact exists, a verification code has been sent.",
        customerId,
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer registration error:", error);
    return NextResponse.json(
      { error: "Failed to register" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
