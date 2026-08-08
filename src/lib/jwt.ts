// Minimal HS256 JWT implementation using Web Crypto (no external deps).
// Used to sign and verify MCP OAuth access tokens.

import { nowSeconds } from './utils';

export interface JwtPayload {
  iss: string;
  sub: string;
  aud?: string;
  exp: number;
  iat: number;
  jti: string;
  client_id?: string;
  scopes?: string[];
}

function b64url(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input;
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'> & { exp?: number; iat?: number },
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = nowSeconds();
  const body: JwtPayload = {
    ...payload,
    iat: now,
    exp: payload.exp ?? now + ttlSeconds,
  };
  const headerPart = b64url(JSON.stringify(header));
  const payloadPart = b64url(JSON.stringify(body));
  const key = await importKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerPart}.${payloadPart}`)),
  );
  return `${headerPart}.${payloadPart}.${b64url(sig)}`;
}

export type VerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: string };

export async function verifyJwt(token: string, secret: string): Promise<VerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };
  const [headerPart, payloadPart, sigPart] = parts;
  try {
    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sigPart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) return { ok: false, reason: 'bad signature' };
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadPart))) as JwtPayload;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds()) {
      return { ok: false, reason: 'token expired' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'invalid token' };
  }
}

export function generateJti(): string {
  return crypto.randomUUID();
}
