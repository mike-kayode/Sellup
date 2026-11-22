import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { verifyPasswordResetToken } from "@/lib/password-reset-token";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`reset-password:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { token, password } = resetSchema.parse(body);

    const payload = verifyPasswordResetToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired reset session. Please start again." },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || user.email.trim().toLowerCase() !== payload.email) {
      return NextResponse.json(
        { error: "Invalid or expired reset session. Please start again." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password, email_confirm: true }
    );

    if (updateError) {
      console.error("Supabase password reset error:", updateError.message);
      return NextResponse.json(
        { error: "Could not update your password. Please try again." },
        { status: 502 }
      );
    }

    // The 6-digit code proved email ownership; mark verified and revoke
    // existing app sessions/tokens issued before this reset.
    await db
      .update(users)
      .set({
        isEmailVerified: true,
        sessionsRevokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      message:
        "Password reset successfully. Please sign in with your new password.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
