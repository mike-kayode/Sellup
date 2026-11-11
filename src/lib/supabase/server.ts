/**
 * Supabase server client
 * Used for trusted server-side operations requiring the service-role key.
 * NEVER import this into client components.
 */
import { createClient } from "@supabase/supabase-js";
import { AuthError } from "@supabase/auth-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  isAdminImpersonationToken,
  resolveActiveImpersonation,
} from "@/lib/admin-impersonation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

function getTokenIssuedAt(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    if (
      !decoded ||
      typeof decoded !== "object" ||
      !("iat" in decoded) ||
      typeof decoded.iat !== "number" ||
      !Number.isFinite(decoded.iat)
    ) {
      return null;
    }
    return decoded.iat * 1000;
  } catch {
    return null;
  }
}

if (supabaseAdmin) {
  const getSupabaseUser = supabaseAdmin.auth.getUser.bind(supabaseAdmin.auth);
  supabaseAdmin.auth.getUser = async (jwt) => {
    if (jwt && isAdminImpersonationToken(jwt)) {
      try {
        const impersonation = await resolveActiveImpersonation(jwt);
        if (impersonation) {
          const result = await supabaseAdmin.auth.admin.getUserById(
            impersonation.merchantUserId
          );
          if (!result.error && result.data.user) {
            return { data: { user: result.data.user }, error: null };
          }
        }
      } catch (error) {
        console.error("Admin impersonation token lookup failed:", error);
      }
      return {
        data: { user: null },
        error: new AuthError("Invalid impersonation session", 401, "session_not_found"),
      };
    }

    const result = await getSupabaseUser(jwt);
    if (result.error || !result.data.user || !jwt) return result;

    try {
      const [account] = await db
        .select({
          isActive: users.isActive,
          sessionsRevokedAt: users.sessionsRevokedAt,
        })
        .from(users)
        .where(eq(users.id, result.data.user.id))
        .limit(1);
      if (!account) return result;
      if (!account.isActive) {
        return {
          data: { user: null },
          error: new AuthError("Account is inactive", 401, "user_banned"),
        };
      }
      if (account.sessionsRevokedAt) {
        const issuedAt = getTokenIssuedAt(jwt);
        if (
          issuedAt === null ||
          issuedAt < account.sessionsRevokedAt.getTime()
        ) {
          return {
            data: { user: null },
            error: new AuthError("Session has been revoked", 401, "session_revoked"),
          };
        }
      }
      return result;
    } catch (error) {
      console.error("Supabase account status lookup failed:", error);
      return {
        data: { user: null },
        error: new AuthError("Account status could not be verified", 503, "account_lookup_failed"),
      };
    }
  };
}

/**
 * Helper to guard against missing service-role config on the server.
 */
export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return supabaseAdmin;
}
