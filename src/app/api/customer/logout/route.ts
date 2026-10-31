import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  buyerCookieName,
  clearSessionCookie,
  revokeSessionByToken,
} from "@/lib/customer-auth";

const logoutSchema = z.object({
  storeSlug: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`customer-logout:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { storeSlug } = logoutSchema.parse(body);

    // Validate the store exists (derive store_id from slug, never trust raw id).
    const [store] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.storeSlug, storeSlug))
      .limit(1);
    const storeId = store?.id ?? null;

    const cookieName = buyerCookieName(storeSlug);

    // Revoke the current session if we know the store (fail closed).
    if (storeId) {
      try {
        await revokeSessionByToken(storeId, cookieName, request.headers);
      } catch {
        // ignore — cookie will still be cleared
      }
    }

    const cookieStore = await cookies();
    cookieStore.set({
      name: cookieName,
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ message: "Logged out successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Customer logout error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
