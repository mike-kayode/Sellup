/**
 * Rate limiting for Sell Up API
 * Currently memory-based, use Redis in production
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
export const RATE_LIMITS = {
  AUTH: { requests: 10, windowMs: 15 * 60 * 1000 }, // 10 requests per 15 min
  API: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  SEARCH: { requests: 50, windowMs: 60 * 1000 }, // 50 searches per minute
  WEBHOOK: { requests: 1000, windowMs: 60 * 1000 }, // 1000 per minute
};

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // Create new entry if doesn't exist
  if (!entry) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });

    return {
      success: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  // Check if window has reset
  if (now >= entry.resetTime) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });

    return {
      success: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Increment count
  entry.count++;

  return {
    success: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get rate limit for authentication
 */
export function checkAuthRateLimit(identifier: string): RateLimitResult {
  const key = `auth:${identifier}`;
  return checkRateLimit(
    key,
    RATE_LIMITS.AUTH.requests,
    RATE_LIMITS.AUTH.windowMs
  );
}

/**
 * Get rate limit for API
 */
export function checkApiRateLimit(identifier: string): RateLimitResult {
  const key = `api:${identifier}`;
  return checkRateLimit(
    key,
    RATE_LIMITS.API.requests,
    RATE_LIMITS.API.windowMs
  );
}

/**
 * Get rate limit for search
 */
export function checkSearchRateLimit(identifier: string): RateLimitResult {
  const key = `search:${identifier}`;
  return checkRateLimit(
    key,
    RATE_LIMITS.SEARCH.requests,
    RATE_LIMITS.SEARCH.windowMs
  );
}

/**
 * Clean up old entries (run periodically)
 */
export function cleanupRateLimitMap(): void {
  const now = Date.now();

  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Get current rate limit stats
 */
export function getRateLimitStats(): {
  totalEntries: number;
  oldestReset: number;
  newestReset: number;
} {
  if (rateLimitMap.size === 0) {
    return {
      totalEntries: 0,
      oldestReset: Date.now(),
      newestReset: Date.now(),
    };
  }

  const resetTimes = Array.from(rateLimitMap.values()).map((e) => e.resetTime);

  return {
    totalEntries: rateLimitMap.size,
    oldestReset: Math.min(...resetTimes),
    newestReset: Math.max(...resetTimes),
  };
}
