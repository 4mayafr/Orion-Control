/**
 * Fixed-window rate limiter.
 *
 * LIMITATION: state lives in the memory of one serverless instance, so limits
 * are approximate across instances. That is acceptable for brute-force
 * protection on a small operations dashboard — it is a speed bump, not a
 * distributed quota. Account lockout and audit logging are the real controls.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, windowMs: number, max: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_KEYS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size > MAX_KEYS) buckets.clear();
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSeconds: Math.ceil(windowMs / 1_000) };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1_000));
  if (existing.count > max) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: max - existing.count, retryAfterSeconds };
}
