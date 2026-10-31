import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/db";
import { customers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  buyerCookieName,
  createCustomerSession,
  compareCustomerPassword,
} from "@/lib/customer-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";

const loginSchema = z.object({
  storeSlug: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-login:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug, email, phone, password } = loginSchema.parse(body);

    const rawEmail = (email || "").trim().toLowerCase() || null;
    const rawPhone = (phone || "").trim() || null;
    if (!rawEmail && !rawPhone) {
      return NextResponse.json(
        { error: "Email or phone is required" },
        { status: 400 }
      );
    }

    const [store] = await db
      .select({ id: businesses.id, storeName: businesses.storeName, storeSlug: businesses.storeSlug })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const storeId = store.id;

    // Tenant-scoped lookup: buyer must belong to this store. Try phone first,
    // then email (checkout upserts by phone, so phone is the primary key).
    let customer: {
      id: string;
      storeId: string;
      name: string;
      phone: string | null;
      email: string | null;
      passwordHash: string;
      isEmailVerified: boolean;
      isWhatsAppVerified: boolean;
    } | null = null;

    if (rawPhone) {
      const [row] = await db
        .select({
          id: customers.id,
          storeId: customers.storeId,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          passwordHash: customers.passwordHash,
          isEmailVerified: customers.isEmailVerified,
          isWhatsAppVerified: customers.isWhatsAppVerified,
        })
        .from(customers)
        .where(
          and(eq(customers.storeId, storeId), eq(customers.phone, rawPhone))
        )
        .limit(1);
      customer = row ?? null;
    }
    if (!customer && rawEmail) {
      const [row] = await db
        .select({
          id: customers.id,
          storeId: customers.storeId,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          passwordHash: customers.passwordHash,
          isEmailVerified: customers.isEmailVerified,
          isWhatsAppVerified: customers.isWhatsAppVerified,
        })
        .from(customers)
        .where(
          and(eq(customers.storeId, storeId), eq(customers.email, rawEmail))
        )
        .limit(1);
      customer = row ?? null;
    }

    // Fail closed: no customer, wrong password, or no password hash set.
    const hash = customer?.passwordHash ?? null;
    const passwordOk = hash ? await compareCustomerPassword(password, hash) : false;
    if (!customer || !passwordOk) {
      return NextResponse.json({ error: "Invalid email/phone or password" }, { status: 401 });
    }

    // Create session with per-store cookie name.
    const cookieName = buyerCookieName(store.storeSlug);
    const { token, session } = await createCustomerSession({
      storeId,
      customerId: customer.id,
      cookieName,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    // Set HttpOnly cookie.
    const cookieStore = await cookies();
    cookieStore.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Audit the login (auditing must never fail the login).
    try {
      await createMerchantAuditLog({
        actorId: customer.id,
        actorRole: "customer",
        action: "customer.login",
        resourceType: "customer",
        resourceId: customer.id,
        storeId,
        previousValue: undefined,
        newValue: { storeId, customerId: customer.id },
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch {
      // ignore audit failures
    }

    return NextResponse.json({
      message: "Logged in successfully",
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        isEmailVerified: customer.isEmailVerified,
        isWhatsAppVerified: customer.isWhatsAppVerified,
      },
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer login error:", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
