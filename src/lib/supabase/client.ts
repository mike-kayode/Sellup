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
