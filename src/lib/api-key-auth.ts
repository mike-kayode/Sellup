/**
 * Sell Up merchant API key authentication (Phase 6).
 *
 * API keys are per-store (store_id on api_keys). Only the SHA-256 hash is
 * stored; the raw key is shown once at creation. Enforces store_id ownership
 * on every use. Fail closed: any lookup failure denies.
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface ApiKeyContext {
  keyId: string;
  storeId: string;
  name: string;
  scopes: string[];
  prefix: string;
}

export interface ApiKeyAuthResult {
  key: ApiKeyContext | null;
  error: NextResponse | null;
}

export const API_KEY_HEADER_NAMES = ["authorization", "x-api-key"];

function extractBearerKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const xKey = request.headers.get("x-api-key");
  if (xKey) return xKey;
  return null;
}

/**
 * Authenticate an API key from the request. Returns the key context on
 * success, or a 401/403 response on failure. Never leaks whether a hash
 * exists for a given key.
 */
export async function requireApiKey(
  request: NextRequest
): Promise<ApiKeyAuthResult> {
  const rawKey = extractBearerKey(request);
  if (!rawKey) {
    return {
      key: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const hashedKey = cryptoCreateHash(rawKey);

  let row: {
    id: string;
    storeId: string;
    name: string;
    scopes: unknown;
    prefix: string;
    isActive: boolean;
    expiresAt: Date | null;
  } | null = null;
  try {
    const [r] = await db
      .select({
        id: apiKeys.id,
        storeId: apiKeys.storeId,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        prefix: apiKeys.prefix,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.hashedKey, hashedKey))
      .limit(1);
    row = r ?? null;
  } catch {
    return {
      key: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (!row || !row.isActive) {
    return {
      key: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
    return {
      key: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const scopes: string[] = Array.isArray(row.scopes) ? row.scopes : [];

  // Record last use (best effort; never fails the request).
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        lastUsedIp: ip ?? undefined,
      })
      .where(eq(apiKeys.id, row.id));
  } catch {
    // ignore
  }

  return {
    key: {
      keyId: row.id,
      storeId: row.storeId,
      name: row.name,
      scopes,
      prefix: row.prefix,
    },
    error: null,
  };
}

/**
 * Require the caller's key to hold one of the given scopes.
 */
export function requireScopes(
  key: ApiKeyContext,
  required: string[]
): NextResponse | null {
  const hasScope = required.some((s) => key.scopes.includes(s));
  if (!hasScope) {
    return NextResponse.json(
      { error: "Insufficient scope", required },
      { status: 403 }
    );
  }
  return null;
}

function cryptoCreateHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
