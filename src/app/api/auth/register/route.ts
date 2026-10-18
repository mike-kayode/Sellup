import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { upsertUserRecord } from "@/lib/auth";
import { z } from "zod";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { sendVerificationCodeEmail } from "@/lib/email";
import { findUserByEmail, issueVerificationCode } from "@/lib/verification";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = checkAuthRateLimit(`register:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        {
          error: "Too many registration attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Create the user in Supabase Auth
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: false,
      user_metadata: {
        full_name: validatedData.fullName,
        phone: validatedData.phone || "",
      },
    });

    if (error) {
      if (error.status === 409 || error.message.includes("already")) {
        // The email may belong to an account that never finished
        // verification — resend a fresh code instead of dead-ending.
        try {
          const existing = await findUserByEmail(validatedData.email);
          if (existing) {
            const { data: authData } = await supabase.auth.admin.getUserById(
              existing.id
            );
            if (authData.user && !authData.user.email_confirmed_at) {
              const code = await issueVerificationCode(existing.email);
              const sent = await sendVerificationCodeEmail(
                existing.email,
                code,
                existing.fullName || undefined
              );
              if (sent) {
                return NextResponse.json(
                  {
                    message: "Verification code sent to your email",
                    requiresVerification: true,
                    email: existing.email,
                    user: {
                      id: existing.id,
                      email: existing.email,
                      fullName: existing.fullName,
                    },
                  },
                  { status: 200 }
                );
              }
            }
          }
        } catch (resumeError) {
          console.error(
            "Verification resend on duplicate email failed:",
            resumeError
          );
        }
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }
      console.error("Supabase create user error:", error.message);
      return NextResponse.json(
        { error: "Failed to register user" },
        { status: 500 }
      );
    }

    const supabaseUser = data.user;

    if (!supabaseUser) {
      return NextResponse.json(
        { error: "Failed to register user" },
        { status: 500 }
      );
    }

    // Sync into our users table first — verify/resend flows need the row
    // even if the email send below fails.
    const userRecord = await upsertUserRecord({
      id: supabaseUser.id,
      email: supabaseUser.email || validatedData.email,
      fullName: validatedData.fullName,
      phone: validatedData.phone,
    });

    // Issue a 6-digit code (stored as a hash) and email it via Resend from
    // no-reply@sellup.ng. The Supabase account stays unconfirmed until the
    // code is entered on /verify.
    const codeEmail = supabaseUser.email || validatedData.email;
    const code = await issueVerificationCode(codeEmail);
    const emailSent = await sendVerificationCodeEmail(
      codeEmail,
      code,
      validatedData.fullName
    );
    if (!emailSent) {
      console.error("Failed to send verification code email");
      return NextResponse.json(
        {
          error:
            "We couldn't send the verification email. Please try resending the code.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        message: "Verification code sent to your email",
        requiresVerification: true,
        email: codeEmail,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          fullName: userRecord.fullName,
        },
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

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
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
