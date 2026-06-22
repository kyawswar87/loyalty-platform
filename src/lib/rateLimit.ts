/**
 * Minimal fixed-window rate limiter for `/api/v1/*` mutations, keyed per API key.
 *
 * In-memory, so the window is per server instance — fine for the MVP and local
 * dev; a multi-instance deployment would swap the `Map` for Redis/Upstash with
 * the same interface. `now` is injectable for testing.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const DEFAULT_LIMIT = 60;
export const DEFAULT_WINDOW_MS = 60_000;

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfter: number };

export function rateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
  now = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

/** Test helper — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
