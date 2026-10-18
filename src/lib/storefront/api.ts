/**
 * Shared auth for merchant storefront-config APIs.
 * Pattern mirrors /api/stores/update: Bearer token -> Supabase user ->
 * ownership check on the business row.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface StoreAccessOk {
  ok: true;
  userId: string;
  store: typeof stores.$inferSelect;
}

export interface StoreAccessDenied {
  ok: false;
  response: NextResponse;
}

export type StoreAccessResult = StoreAccessOk | StoreAccessDenied;

function deny(status: number, error: string): StoreAccessDenied {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Resolve the authenticated merchant and verify they own `storeId`.
 * Never trust a client-supplied store id without this check (tenant rule).
 */
export async function requireStoreOwnership(
  request: NextRequest,
  storeId: string
): Promise<StoreAccessResult> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return deny(401, "Unauthorized");

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(auth.slice(7));

  if (authError || !user) return deny(401, "Unauthorized");

  const rows = await db
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (rows.length === 0) return deny(404, "Store not found");
  if (rows[0].userId !== user.id) {
    return deny(403, "You do not have access to this store");
  }

  return { ok: true, userId: user.id, store: rows[0] };
}