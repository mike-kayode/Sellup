/** Database-backed rate limiting for Sell Up API.
 *
 * Counters live in rate_limit_counters so limits survive restarts and work
 * across multiple cPanel/Node processes. Falls back to in-memory only when
 * the DB is unreachable (availability over strictness during an outage).
 *
 * checkRateLimit stays synchronous. checkAuthRateLimit,
 * checkApiRateLimit, checkSearchRateLimit are now async — await them.
 */

import { db } from "@/db";
import { rateLimitCounters } from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";

interface MemoryEntry {
  count: number;
  resetTime: number;
}

const memoryMap = new Map<string, MemoryEntry>();

export const RATE_LIMITS = {
  AUTH: { requests: 10, windowMs: 15 * 60 * 1000 },
  API: { requests: 100, windowMs: 60 * 1000 },
  SEARCH: { requests: 50, windowMs: 60 * 1000 },
  WEBHOOK: { requests: 1000, windowMs: 60 * 1000 },
};

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

function retryAfterFor(resetTime: number, now: number): number {
  return Math.max(0, Math.ceil((resetTime - now) / 1000));
}

/* ------------------------------------------------------------------ */
/* Synchronous in-memory check (fallback + testable path)             */
/* ------------------------------------------------------------------ */

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryMap.get(key);

  if (!entry || now >= entry.resetTime) {
    memoryMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, resetTime: now + windowMs };
  }
  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: retryAfterFor(entry.resetTime, now),
    };
  }
  entry.count++;
  return {
    success: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/* ------------------------------------------------------------------ */
/* Database-backed check                                              */
/* ------------------------------------------------------------------ */

async function dbRateLimit(
  identifier: string,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  try {
    const now = Date.now();
    const windowStart = new Date(now - windowMs);

    await db.delete(rateLimitCounters).where(lt(rateLimitCounters.windowStart, windowStart));

    const [existing] = await db
      .select()
      .from(rateLimitCounters)
      .where(
        and(
          eq(rateLimitCounters.identifier, identifier),
          eq(rateLimitCounters.endpoint, endpoint),
          gte(rateLimitCounters.windowStart, windowStart)
        )
      )
      .limit(1);

    let count: number;
    let resetTime: number;

    if (existing) {
      count = Number(existing.count) + 1;
      resetTime = new Date(existing.windowStart).getTime() + windowMs;
      await db
        .update(rateLimitCounters)
        .set({ count, updatedAt: new Date() })
        .where(eq(rateLimitCounters.id, existing.id));
    } else {
      count = 1;
      resetTime = now + windowMs;
      await db.insert(rateLimitCounters).values({
        identifier,
        endpoint,
        count: 1,
        windowStart: new Date(now),
        updatedAt: new Date(),
      });
    }

    const success = count <= limit;
    return {
      success,
      remaining: Math.max(0, limit - count),
      resetTime,
      ...(success ? {} : { retryAfter: retryAfterFor(resetTime, now) }),
    };
  } catch (err) {
    console.error("[rate-limit] DB check failed, falling back to memory:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public async helpers                                               */
/* ------------------------------------------------------------------ */

export async function checkAuthRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const key = "auth:" + identifier;
  const dbResult = await dbRateLimit(
    key,
    "auth",
    RATE_LIMITS.AUTH.requests,
    RATE_LIMITS.AUTH.windowMs
  );
  if (dbResult) return dbResult;
  return checkRateLimit(key, RATE_LIMITS.AUTH.requests, RATE_LIMITS.AUTH.windowMs);
}

export async function checkApiRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const key = "api:" + identifier;
  const dbResult = await dbRateLimit(
    key,
    "api",
    RATE_LIMITS.API.requests,
    RATE_LIMITS.API.windowMs
  );
  if (dbResult) return dbResult;
  return checkRateLimit(key, RATE_LIMITS.API.requests, RATE_LIMITS.API.windowMs);
}

export async function checkSearchRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const key = "search:" + identifier;
  const dbResult = await dbRateLimit(
    key,
    "search",
    RATE_LIMITS.SEARCH.requests,
    RATE_LIMITS.SEARCH.windowMs
  );
  if (dbResult) return dbResult;
  return checkRateLimit(
    key,
    RATE_LIMITS.SEARCH.requests,
    RATE_LIMITS.SEARCH.windowMs
  );
}

/* ------------------------------------------------------------------ */
/* Legacy sync helpers retained for compatibility                     */
/* ------------------------------------------------------------------ */

export function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [key, entry] of memoryMap.entries()) {
    if (entry.resetTime < now) memoryMap.delete(key);
  }
}

export function getRateLimitStats(): {
  totalEntries: number;
  oldestReset: number;
  newestReset: number;
} {
  if (memoryMap.size === 0) {
    return { totalEntries: 0, oldestReset: Date.now(), newestReset: Date.now() };
  }
  const resetTimes = Array.from(memoryMap.values()).map((e) => e.resetTime);
  return {
    totalEntries: memoryMap.size,
    oldestReset: Math.min(...resetTimes),
    newestReset: Math.max(...resetTimes),
  };
}
