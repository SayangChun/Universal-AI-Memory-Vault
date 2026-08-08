// Shared helpers for the REST API routes.
import { getSessionUser } from './auth';
import { rateLimit, rateLimitEnabled, rateLimitRpm } from './rate-limit';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function apiError(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ error: err.code ?? 'error', message: err.message }, err.status);
  }
  if (err instanceof Error) {
    return json({ error: 'server_error', message: err.message }, 500);
  }
  return json({ error: 'server_error', message: 'Unknown error' }, 500);
}

/** Returns the authenticated session user or throws a 401 ApiError. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, 'Not authenticated', 'unauthorized');
  return user;
}

/** Optional session user (routes that work signed-out). */
export async function maybeUser() {
  return getSessionUser();
}

/** Apply the per-user sliding-window rate limit. Throws 429 ApiError when exceeded. */
export function applyRateLimit(userId: string, scope: string): void {
  if (!rateLimitEnabled()) return;
  const result = rateLimit(`${userId}:${scope}`, rateLimitRpm());
  if (!result.allowed) {
    throw new ApiError(429, `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s`, 'rate_limited');
  }
}
