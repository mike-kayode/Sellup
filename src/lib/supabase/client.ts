/**
 * Supabase browser client
 * Used for client-side auth and storage operations.
 * Uses the anon/public key (safe for browser).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const ADMIN_IMPERSONATION_STORAGE_KEY =
  "sellup.admin-impersonation-session";

export interface BrowserAdminImpersonation {
  accessToken: string;
  merchantUserId: string;
  merchantEmail: string;
  merchantFullName: string;
  storeId: string;
  storeName: string;
  expiresAt: string;
}

export function getBrowserAdminImpersonation(): BrowserAdminImpersonation | null {
  if (typeof window === "undefined") return null;

  try {
    const serialized = window.sessionStorage.getItem(
      ADMIN_IMPERSONATION_STORAGE_KEY
    );
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    if (
      !value ||
      typeof value !== "object" ||
      !("accessToken" in value) ||
      !("merchantUserId" in value) ||
      !("merchantEmail" in value) ||
      !("merchantFullName" in value) ||
      !("storeId" in value) ||
      !("storeName" in value) ||
      !("expiresAt" in value) ||
      typeof value.accessToken !== "string" ||
      typeof value.merchantUserId !== "string" ||
      typeof value.merchantEmail !== "string" ||
      typeof value.merchantFullName !== "string" ||
      typeof value.storeId !== "string" ||
      typeof value.storeName !== "string" ||
      typeof value.expiresAt !== "string" ||
      !value.accessToken.startsWith("imp_") ||
      !Number.isFinite(Date.parse(value.expiresAt))
    ) {
      window.sessionStorage.removeItem(ADMIN_IMPERSONATION_STORAGE_KEY);
      return null;
    }

    return {
      accessToken: value.accessToken,
      merchantUserId: value.merchantUserId,
      merchantEmail: value.merchantEmail,
      merchantFullName: value.merchantFullName,
      storeId: value.storeId,
      storeName: value.storeName,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

export function storeBrowserAdminImpersonation(
  impersonation: BrowserAdminImpersonation
) {
  window.sessionStorage.setItem(
    ADMIN_IMPERSONATION_STORAGE_KEY,
    JSON.stringify(impersonation)
  );
}

export function clearBrowserAdminImpersonation() {
  window.sessionStorage.removeItem(ADMIN_IMPERSONATION_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Session-read retry (fixes the "intermittently logged out" reports).
//
// When two tabs are open, one tab's token refresh can rotate the refresh
// token the other tab still holds; a concurrent getSession() then resolves
// null even though a valid session has already been persisted to storage.
// Every dashboard page treats a null session as "logged out" and redirects
// to /login — so the losing tab bounces the user out for no reason.
//
// Retrying the read lets the losing tab pick up the session the winning tab
// persisted instead of bouncing. Genuinely signed-out reads simply resolve
// null ~800ms later (a one-time cost on the login redirect only).
// ---------------------------------------------------------------------------
if (supabase) {
  const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
  const SESSION_READ_RETRIES = 2;
  const SESSION_RETRY_DELAY_MS = 400;

  supabase.auth.getSession = async () => {
    for (let attempt = 0; ; attempt++) {
      const result = await originalGetSession();
      if (result.data.session || attempt >= SESSION_READ_RETRIES) {
        const impersonation = getBrowserAdminImpersonation();
        if (
          result.error === null &&
          result.data.session &&
          impersonation &&
          Date.parse(impersonation.expiresAt) > Date.now() &&
          window.location.pathname.startsWith("/dashboard")
        ) {
          const session = result.data.session;
          return {
            ...result,
            data: {
              ...result.data,
              session: {
                ...session,
                access_token: impersonation.accessToken,
                user: {
                  ...session.user,
                  id: impersonation.merchantUserId,
                  email: impersonation.merchantEmail,
                  user_metadata: {
                    ...session.user.user_metadata,
                    full_name: impersonation.merchantFullName,
                    role: "merchant",
                  },
                },
              },
            },
          };
        }
        return result;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, SESSION_RETRY_DELAY_MS)
      );
    }
  };
}

/**
 * Helper to guard against missing Supabase config on the client.
 */
export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      "Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}
