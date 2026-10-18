/**
 * Sell Up authentication helpers.
 *
 * Uses Supabase Auth for session management (JWT-based, httpOnly cookies
 * via Supabase's built-in cookie handling when using SSR, or the browser
 * client for client components).
 *
 * Also provides a small helper to map a Supabase user to our `users` table
 * record (so the rest of the app can query by `users.id`).
 */
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase/client";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  isEmailVerified: boolean | null;
}

/**
 * Get the current authenticated user from the Supabase browser client.
 * Only callable from client components / event handlers.
 */
export async function getCurrentUserClient(): Promise<CurrentUser | null> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email || "",
    fullName: (user.user_metadata?.full_name as string) || null,
    phone: (user.user_metadata?.phone as string) || null,
    isEmailVerified: user.email_confirmed_at ? true : false,
  };
}

/**
 * Get the current user id from the Supabase session (client).
 */
export async function getCurrentUserIdClient(): Promise<string | null> {
  const user = await getCurrentUserClient();
  return user?.id ?? null;
}

/**
 * Look up a row in our `users` table by the Supabase auth user id.
 * The Supabase auth user id is used as the `users.id` primary key.
 */
export async function findUserRecord(userId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Upsert a row into our `users` table for a Supabase auth user.
 * Keeps the app's `users` table in sync with Supabase Auth.
 */
export async function upsertUserRecord(input: {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
}) {
  const existing = await findUserRecord(input.id);
  if (existing) {
    return existing;
  }

  const inserted = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      password: "", // Auth is delegated to Supabase; no app password stored
      fullName: input.fullName || input.email,
      phone: input.phone || null,
    })
    .returning();
  return inserted[0];
}

/**
 * Create a browser Supabase client from a given URL/key (used in layouts).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anonKey);
}
