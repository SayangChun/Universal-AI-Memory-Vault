// Small shared helpers.
import { createHash, randomBytes } from 'node:crypto';

/** SHA-256 hex digest of a string (used for tokens, auth codes, client secrets). */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Generate a cryptographically random string. */
export function randomId(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Generate a URL-safe random token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Prefix of a token for display purposes (never the full token). */
export function tokenPrefix(token: string): string {
  return token.slice(0, 8) + '…';
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Truncate long text for previews. */
export function truncate(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** Safe JSON parse that never throws. */
export function safeJsonParse<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Format an ISO timestamp for display (UTC → local). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
