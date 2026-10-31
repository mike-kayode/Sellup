import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  MAX_ATTEMPTS,
  consumeVerification,
  findUserByEmail,
  verifyEmailCode,
} from "@/lib/verification";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`verify:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, code } = verifySchema.parse(body);

    const result = await verifyEmailCode(email, code);
    if (!result.ok) {
      if (result.reason === "invalid") {
        const remaining = Math.max(MAX_ATTEMPTS - result.attempts, 0);
        return NextResponse.json(
          {
            error: `Incorrect code. ${remaining} attempt${
              remaining === 1 ? "" : "s"
            } remaining.`,
          },
          { status: 400 }
        );
      }
      if (result.reason === "expired") {
        return NextResponse.json(
          { error: "This code has expired. Please request a new one." },
          { status: 400 }
        );
      }
      if (result.reason === "locked") {
        return NextResponse.json(
          {
            error:
              "Too many incorrect attempts. Please request a new code.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error:
            "No pending verification for this email. Please register again.",
        },
        { status: 400 }
      );
    }

    // Code matched — find our user row and activate the Supabase account.
    const userRecord = await findUserByEmail(email);
    if (!userRecord) {
      return NextResponse.json(
        { error: "Account not found. Please register again." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      userRecord.id,
      { email_confirm: true }
    );
    if (confirmError) {
      console.error("Supabase email confirm error:", confirmError.message);
      return NextResponse.json(
        { error: "Could not activate your account. Please try again." },
        { status: 502 }
      );
    }

    await db
      .update(users)
      .set({ isEmailVerified: true })
      .where(eq(users.id, userRecord.id));

    // Burn the code so it can't be replayed.
    await consumeVerification(email);

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
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
