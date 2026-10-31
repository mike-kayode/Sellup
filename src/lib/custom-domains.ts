/**
 * Sell Up custom domain resolver (Phase 4).
 *
 * Resolves an active custom hostname to its store via a short-lived in-memory
 * cache (bounded, no long-running process). Requires a shared-secret header
 * set by Cloudflare so hostnames cannot be spoofed by direct requests.
 */

import { db } from "@/db";
import { domains, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface CustomDomainResolution {
  storeId: string;
  storeSlug: string;
  domain: string;
  isPrimary: boolean;
}

interface CacheEntry {
  resolution: CustomDomainResolution | null;
  at: number;
}

// 5-minute cache, bounded to ~500 entries to respect shared-hosting memory cap.
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();

function cacheKey(hostname: string): string {
  return hostname.toLowerCase();
}

function evictIfNeeded(): void {
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = Array.from(cache.entries()).sort(
      (a, b) => a[1].at - b[1].at
    )[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

/**
 * Resolve a hostname to its store if it's an active custom domain.
 * Returns null when the hostname isn't a custom domain or isn't active.
 * Results are cached for CACHE_TTL_MS.
 */
export async function resolveCustomDomain(
  hostname: string
): Promise<CustomDomainResolution | null> {
  const key = cacheKey(hostname);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.resolution;

  let resolution: CustomDomainResolution | null = null;
  try {
    const rows = await db
      .select({
        id: domains.id,
        storeId: domains.storeId,
        domain: domains.domain,
        status: domains.status,
      })
      .from(domains)
      .where(eq(domains.domain, hostname.toLowerCase()))
      .limit(1);

    if (rows.length === 0) {
      resolution = null;
    } else if (rows[0].status !== "active") {
      resolution = null;
    } else {
      const bizRows = await db
        .select({ id: businesses.id, storeSlug: businesses.storeSlug })
        .from(businesses)
        .where(eq(businesses.id, rows[0].storeId))
        .limit(1);
      resolution = bizRows.length > 0
        ? {
            storeId: rows[0].storeId,
            storeSlug: bizRows[0].storeSlug,
            domain: rows[0].domain,
            isPrimary: true,
          }
        : null;
    }
  } catch {
    resolution = null;
  }

  evictIfNeeded();
  cache.set(key, { resolution, at: now });
  return resolution;
}

export function clearCustomDomainCache(): void {
  cache.clear();
}
