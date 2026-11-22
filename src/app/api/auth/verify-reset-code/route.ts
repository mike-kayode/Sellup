import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import {
  MAX_ATTEMPTS,
  consumeVerification,
  findUserByEmail,
  verifyEmailCode,
} from "@/lib/verification";
import { createPasswordResetToken } from "@/lib/password-reset-token";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`verify-reset:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, code } = verifySchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const result = await verifyEmailCode(normalizedEmail, code);
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
            error: "Too many incorrect attempts. Please request a new code.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error:
            "No pending password reset request for this email. Please request a new code.",
        },
        { status: 400 }
      );
    }

    const userRecord = await findUserByEmail(normalizedEmail);
    if (!userRecord) {
      return NextResponse.json(
        { error: "Unable to reset password for this account." },
        { status: 400 }
      );
    }

    // Burn the code so it can't be replayed, then issue a short-lived token
    // that authorizes setting a new password.
    await consumeVerification(normalizedEmail);
    const token = createPasswordResetToken(userRecord.id, userRecord.email);

    return NextResponse.json({
      message: "Code verified",
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Verify reset code error:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
