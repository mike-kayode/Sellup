import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { findUserRecord } from "@/lib/auth";
import { z } from "zod";
import { checkAuthRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`login:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Sign in via Supabase Auth (server-side with admin client so we can
    // verify the credentials and return a session token).
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      const message = (error.message || "").toLowerCase();
      if (
        error.code === "email_not_confirmed" ||
        message.includes("email not confirmed")
      ) {
        return NextResponse.json(
          {
            error:
              "Your email hasn't been verified yet. Check your inbox for your 6-digit code.",
            code: "EMAIL_NOT_VERIFIED",
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const session = data.session;
    const supabaseUser = data.user;

    // Load the app user record
    let userRecord = supabaseUser
      ? await findUserRecord(supabaseUser.id)
      : null;

    // If the user row doesn't exist yet, sync it from the auth user.
    if (supabaseUser && !userRecord) {
      const { upsertUserRecord } = await import("@/lib/auth");
      userRecord = await upsertUserRecord({
        id: supabaseUser.id,
        email: supabaseUser.email || validatedData.email,
        fullName: (supabaseUser.user_metadata?.full_name as string) || "",
        phone: (supabaseUser.user_metadata?.phone as string) || null,
      });
    }

    return NextResponse.json(
      {
        message: "Logged in successfully",
        session: session
          ? {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
            }
          : null,
        user: {
          id: userRecord?.id || supabaseUser?.id,
          email: userRecord?.email || supabaseUser?.email || validatedData.email,
          fullName: userRecord?.fullName || supabaseUser?.user_metadata?.full_name || "",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Failed to login" },
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
