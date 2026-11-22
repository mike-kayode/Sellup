import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAuthRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { findUserByEmail, issueVerificationCode } from "@/lib/verification";
import { sendPasswordResetCodeEmail } from "@/lib/email";

const forgotSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`forgot-password:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = forgotSchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    // Per-email cooldown to limit abuse and email volume.
    const cooldown = checkRateLimit(
      `forgot-password-email:${normalizedEmail}`,
      5,
      15 * 60 * 1000
    );
    if (!cooldown.success) {
      return NextResponse.json({
        message:
          "If an account with that email exists, a password reset code has been sent.",
      });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (user) {
      const sendGate = checkRateLimit(
        `forgot-password-send:${normalizedEmail}`,
        1,
        60 * 1000
      );
      if (sendGate.success) {
        const code = await issueVerificationCode(normalizedEmail);
        await sendPasswordResetCodeEmail(
          normalizedEmail,
          code,
          user.fullName || undefined
        ).catch((error) => {
          console.error("Failed to send password reset code email:", error);
        });
      }
    }

    // Generic response to avoid account enumeration.
    return NextResponse.json({
      message:
        "If an account with that email exists, a password reset code has been sent.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
