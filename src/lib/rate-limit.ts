// Lightweight in-memory sliding-window rate limiter.
// NOTE: state is per server instance. On serverless platforms (many
// instances) this is approximate, which is acceptable for an MVP. Set
// ENABLE_RATE_LIMIT=false to disable.

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limitPerMinute: number): RateLimitResult {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (hits.length >= limitPerMinute) {
    const retryAfterMs = hits[0] + 60_000 - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 20_000) buckets.clear();
  return { allowed: true, remaining: limitPerMinute - hits.length, retryAfterMs: 0 };
}

export function rateLimitEnabled(): boolean {
  return process.env.ENABLE_RATE_LIMIT !== 'false';
}

export function rateLimitRpm(): number {
  const n = Number(process.env.RATE_LIMIT_RPM ?? 120);
  return Number.isFinite(n) && n > 0 ? n : 120;
}
