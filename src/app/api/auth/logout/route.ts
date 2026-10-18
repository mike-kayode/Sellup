import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 * Signs the user out of Supabase Auth. Called from the client.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const supabase = getSupabaseAdmin();
      // Invalidate the session server-side
      await supabase.auth.admin.signOut(token);
    }

    return NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
