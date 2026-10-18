import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAuthRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/db";
import { emailVerifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  issueVerificationCode,
  findUserByEmail,
} from "@/lib/verification";
import { sendVerificationCodeEmail } from "@/lib/email";

const resendSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = checkAuthRateLimit(`resend:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = resendSchema.parse(body);

    // Per-email cooldown: max 1 resend every 60s, max 5 per 15 min.
    const cooldown = checkRateLimit(`resend-email:${email}`, 5, 15 * 60 * 1000);
    if (!cooldown.success) {
      return NextResponse.json(
        {
          error:
            "Too many resend requests for this email. Please wait a few minutes.",
        },
        { status: 429 }
      );
    }

    // Only resend when there is an actual pending (unverified) account —
    // responses stay generic to avoid leaking account existence.
    const user = await findUserByEmail(email);
    const pending = await db
      .select({ id: emailVerifications.id })
      .from(emailVerifications)
      .where(eq(emailVerifications.email, email.trim().toLowerCase()))
      .limit(1);

    if (!user || pending.length === 0) {
      return NextResponse.json({
        message:
          "If an account with that email needs verification, a new code has been sent.",
      });
    }

    // Throttle actual sends to once per 60 seconds.
    const sinceKey = `resend-send:${email}`;
    const sendGate = checkRateLimit(sinceKey, 1, 60 * 1000);
    if (!sendGate.success) {
      return NextResponse.json({
        message:
          "If an account with that email needs verification, a new code has been sent.",
      });
    }

    const code = await issueVerificationCode(email);
    const sent = await sendVerificationCodeEmail(
      email,
      code,
      user.fullName || undefined
    );
    if (!sent) {
      console.error("Failed to resend verification code email");
      return NextResponse.json(
        { error: "Unable to send verification email. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message:
        "If an account with that email needs verification, a new code has been sent.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Resend verification code error:", error);
    return NextResponse.json(
      { error: "Failed to resend code" },
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
