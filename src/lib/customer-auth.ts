/**
 * Sell Up buyer (customer) session management — Phase 1.
 *
 * Every buyer belongs to exactly one merchant (store). Sessions are a random
 * token in an HttpOnly, Secure, SameSite=Lax cookie named per store; only the
 * SHA-256 hash of the token is stored in customer_sessions. Idle and absolute
 * expiry are enforced; changing the buyer password revokes all sessions.
 *
 * Stores that share the apex origin must use distinct cookie names/paths so
 * one store's buyer never sees another store's session cookie.
 */

import crypto from "crypto";
import { db } from "@/db";
import {
  customers,
  customerSessions,
  customerTokens,
  businesses,
} from "@/db/schema";
import { eq, and, inArray, isNull, gte, lt } from "drizzle-orm";
import { hashPassword, comparePassword } from "@/lib/security";

export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_COOKIE_PREFIX = "sellup_buyer";

export interface CustomerSession {
  id: string;
  storeId: string;
  customerId: string;
  cookieName: string;
  expiresAt: Date;
  lastUsedAt: Date;
}

export interface CustomerSessionResult {
  session: CustomerSession | null;
  customer: {
    id: string;
    storeId: string;
    name: string;
    phone: string | null;
    email: string | null;
    isEmailVerified: boolean;
    isWhatsAppVerified: boolean;
  } | null;
}

/** SHA-256 hash of a token (never store raw tokens). */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Generate a random session token. */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Per-store cookie name. Distinct per store so stores sharing the apex
 * origin never collide on cookies. */
export function buyerCookieName(storeSlug: string): string {
  return `${SESSION_COOKIE_PREFIX}_${storeSlug.replace(/[^a-z0-9_-]/gi, "_")}`;
}

/** Build a Set-Cookie header value for a buyer session. */
export function buildSessionCookie(
  cookieName: string,
  token: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
    domain?: string;
    maxAge?: number;
  } = {}
): string {
  const {
    httpOnly = true,
    secure = true,
    sameSite = "lax",
    path = "/",
    domain,
    maxAge = SESSION_ABSOLUTE_TTL_MS / 1000,
  } = options;
  const parts = [
    `${cookieName}=${token}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

/** Clear a buyer session cookie. */
export function clearSessionCookie(cookieName: string, path = "/"): string {
  return `${cookieName}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * Create a buyer session row + return the raw token (shown once) and the
 * cookie name. Caller sets the cookie on the response.
 */
export async function createCustomerSession(input: {
  storeId: string;
  customerId: string;
  cookieName: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ token: string; session: CustomerSession }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_ABSOLUTE_TTL_MS);

  const [inserted] = await db
    .insert(customerSessions)
    .values({
      storeId: input.storeId,
      customerId: input.customerId,
      tokenHash,
      cookieName: input.cookieName,
      expiresAt,
      lastUsedAt: new Date(now),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();

  return {
    token,
    session: {
      id: inserted.id,
      storeId: inserted.storeId,
      customerId: inserted.customerId,
      cookieName: inserted.cookieName,
      expiresAt: inserted.expiresAt,
      lastUsedAt: inserted.lastUsedAt,
    },
  };
}

/**
 * Validate a buyer session from the request cookie. Returns null when the
 * session is missing, expired, revoked, or the token hash does not match
 * (fail closed). On success updates last_used_at (idle tracking).
 */
export async function getCustomerSession(
  storeId: string,
  cookieName: string,
  reqHeaders: Headers
): Promise<CustomerSessionResult> {
  const cookieHeader = reqHeaders.get("cookie") || "";
  const token = parseCookie(cookieHeader, cookieName);
  if (!token) return { session: null, customer: null };

  const tokenHash = hashToken(token);
  const now = new Date();

  const [session] = await db
    .select({
      id: customerSessions.id,
      storeId: customerSessions.storeId,
      customerId: customerSessions.customerId,
      cookieName: customerSessions.cookieName,
      expiresAt: customerSessions.expiresAt,
      lastUsedAt: customerSessions.lastUsedAt,
      revokedAt: customerSessions.revokedAt,
    })
    .from(customerSessions)
    .where(
      and(
        eq(customerSessions.storeId, storeId),
        eq(customerSessions.tokenHash, tokenHash),
        isNull(customerSessions.revokedAt),
        gte(customerSessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!session) return { session: null, customer: null };

  // Idle expiry: session must have been used within the idle window.
  const lastUsed = new Date(session.lastUsedAt).getTime();
  if (now.getTime() - lastUsed > SESSION_IDLE_TTL_MS) {
    await db
      .update(customerSessions)
      .set({ revokedAt: now })
      .where(eq(customerSessions.id, session.id));
    return { session: null, customer: null };
  }

  // Refresh idle timestamp.
  await db
    .update(customerSessions)
    .set({ lastUsedAt: now })
    .where(eq(customerSessions.id, session.id));

  // Load the customer row (tenant-scoped: must belong to this store).
  const [customer] = await db
    .select({
      id: customers.id,
      storeId: customers.storeId,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      isEmailVerified: customers.isEmailVerified,
      isWhatsAppVerified: customers.isWhatsAppVerified,
    })
    .from(customers)
    .where(
      and(eq(customers.id, session.customerId), eq(customers.storeId, storeId))
    )
    .limit(1);

  if (!customer) return { session: null, customer: null };

  return {
    session: {
      id: session.id,
      storeId: session.storeId,
      customerId: session.customerId,
      cookieName: session.cookieName,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
    },
    customer: {
      id: customer.id,
      storeId: customer.storeId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      isEmailVerified: customer.isEmailVerified,
      isWhatsAppVerified: customer.isWhatsAppVerified,
    },
  };
}

/** Revoke all sessions for a customer (e.g. on password change). */
export async function revokeCustomerSessions(
  storeId: string,
  customerId: string
): Promise<void> {
  await db
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(customerSessions.storeId, storeId),
        eq(customerSessions.customerId, customerId),
        isNull(customerSessions.revokedAt)
      )
    );
}

/** Revoke a single session by token hash. */
export async function revokeSessionByToken(
  storeId: string,
  cookieName: string,
  reqHeaders: Headers
): Promise<void> {
  const cookieHeader = reqHeaders.get("cookie") || "";
  const token = parseCookie(cookieHeader, cookieName);
  if (!token) return;
  await db
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(customerSessions.storeId, storeId),
        eq(customerSessions.tokenHash, hashToken(token)),
        eq(customerSessions.cookieName, cookieName),
        isNull(customerSessions.revokedAt)
      )
    );
}

/** Cleanup expired sessions (bounded, for cron). Returns count removed. */
export async function cleanupExpiredSessions(limit = 1000): Promise<number> {
  const now = new Date();
  const expiredSessions = await db
    .select({ id: customerSessions.id })
    .from(customerSessions)
    .where(
      and(
        isNull(customerSessions.revokedAt),
        lt(customerSessions.expiresAt, now)
      )
    )
    .limit(limit);
  if (expiredSessions.length === 0) return 0;

  await db
    .update(customerSessions)
    .set({ revokedAt: new Date() })
    .where(inArray(customerSessions.id, expiredSessions.map(({ id }) => id)));
  return expiredSessions.length;
}

/** Issue a short-lived customer token (password reset / verify). */
export async function issueCustomerToken(input: {
  storeId: string;
  customerId: string;
  type: "password_reset" | "email_verify" | "whatsapp_verify";
  ttlMs?: number;
}): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = new Date(now + (input.ttlMs ?? 60 * 60 * 1000)); // 1h default

  await db.insert(customerTokens).values({
    storeId: input.storeId,
    customerId: input.customerId,
    type: input.type,
    tokenHash,
    expiresAt,
  });
  return token;
}

/** Consume a customer token (mark used) if valid and not expired. Fail closed. */
export async function consumeCustomerToken(input: {
  storeId: string;
  customerId: string;
  type: string;
  token: string;
}): Promise<boolean> {
  const tokenHash = hashToken(input.token);
  const now = new Date();
  const [row] = await db
    .select({ id: customerTokens.id, usedAt: customerTokens.usedAt })
    .from(customerTokens)
    .where(
      and(
        eq(customerTokens.storeId, input.storeId),
        eq(customerTokens.customerId, input.customerId),
        eq(customerTokens.type, input.type),
        eq(customerTokens.tokenHash, tokenHash),
        isNull(customerTokens.usedAt),
        gte(customerTokens.expiresAt, now)
      )
    )
    .limit(1);
  if (!row) return false;
  await db
    .update(customerTokens)
    .set({ usedAt: now })
    .where(eq(customerTokens.id, row.id));
  return true;
}

/** Parse a single cookie value from a Cookie header. */
function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(
    new RegExp(
      `(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`
    )
  );
  return match ? match[1] : null;
}

/** Hash a buyer password with bcrypt. */
export async function hashCustomerPassword(password: string): Promise<string> {
  return hashPassword(password);
}

/** Compare a buyer password against its hash. */
export async function compareCustomerPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!hash) return false;
  return comparePassword(password, hash);
}

/** Resolve store slug from store id (for per-store cookie naming). */
export async function resolveStoreSlug(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ storeSlug: businesses.storeSlug })
    .from(businesses)
    .where(eq(businesses.id, storeId))
    .limit(1);
  return row?.storeSlug ?? null;
}
