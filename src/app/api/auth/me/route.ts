import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { findUserRecord } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the current authenticated user (from the Supabase JWT).
 * The client sends the access token in the Authorization header.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const supabase = getSupabaseAdmin();

    // Verify the token via Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  let userRecord: Awaited<ReturnType<typeof findUserRecord>> | null = null;
    try {
      userRecord = await findUserRecord(user.id);
    } catch (err) {
      console.warn("[auth/me] users table unavailable:", (err as Error).message);
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email || "",
          fullName:
            userRecord?.fullName ||
            (user.user_metadata?.full_name as string) ||
            "",
          phone: userRecord?.phone || (user.user_metadata?.phone as string) || "",
          isEmailVerified: user.email_confirmed_at ? true : false,
          role: userRecord?.role || "user",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
