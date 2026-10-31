/**
 * Sell Up merchant (store owner) authentication — Phase 1.
 *
 * Derives the merchant's store from the authenticated Supabase session (never
 * from a client-supplied store id). Fail closed: any lookup failure denies.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { db } from "@/db";
import { users, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface MerchantContext {
  userId: string;
  email: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
}

export interface MerchantAuthResult {
  merchant: MerchantContext | null;
  error: NextResponse | null;
}

export async function requireMerchant(
  request: NextRequest
): Promise<MerchantAuthResult> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      merchant: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = auth.slice(7);
  const supabase = getSupabaseAdmin();
  const { data, error: authError } = await supabase.auth.getUser(token);
  if (authError || !data?.user) {
    return {
      merchant: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let userId: string | null = null;
  try {
    const [account] = await db
      .select({ id: users.id, email: users.email, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, data.user.id))
      .limit(1);
    if (!account || account.isActive === false) {
      return {
        merchant: null,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    userId = account.id;
  } catch {
    return {
      merchant: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  let storeId: string | null = null;
  let storeSlug = "";
  let storeName = "";
  try {
    const [business] = await db
      .select({
        id: businesses.id,
        storeSlug: businesses.storeSlug,
        storeName: businesses.storeName,
      })
      .from(businesses)
      .where(eq(businesses.userId, userId!))
      .limit(1);
    if (!business) {
      return {
        merchant: null,
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    storeId = business.id;
    storeSlug = business.storeSlug;
    storeName = business.storeName;
  } catch {
    return {
      merchant: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    merchant: {
      userId: userId!,
      email: data.user.email || "",
      storeId: storeId!,
      storeSlug,
      storeName,
    },
    error: null,
  };
}
