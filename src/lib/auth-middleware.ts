/**
 * Sell Up server-side auth middleware helpers.
 *
 * Centralizes Supabase JWT verification for API routes so we don't repeat
 * the same Authorization-header parsing and `getUser(token)` call in every
 * route handler.
 *
 * Usage:
 *   const { user, error } = await requireAuthenticatedUser(request);
 *   if (error) return error;
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: NextResponse | null;
}

/**
 * Verifies the `Authorization: Bearer <token>` header against Supabase Auth
 * and returns the authenticated user or a 401 response.
 */
export async function requireAuthenticatedUser(
  request: NextRequest
): Promise<AuthResult> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const token = auth.slice(7);
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email || "",
    },
    error: null,
  };
}
