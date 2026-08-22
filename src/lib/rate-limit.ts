/**
 * In-process fixed-window rate limiter for API routes.
 * Adequate for a single-instance deployment; swap the store for Redis/Upstash
 * when running multiple instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, limit };
  }
  bucket.count += 1;
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    limit,
  };
}

/** Best-effort client key from proxy headers. */
export function clientKey(request: Request, suffix = ''): string {
  const headers = request.headers;
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'local';
  return `${ip}:${suffix}`;
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
