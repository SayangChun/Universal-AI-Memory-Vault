import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from '@/lib/jwt';
import { sha256, randomToken } from '@/lib/utils';

describe('JWT (HS256)', () => {
  const secret = 'test-secret';

  it('signs and verifies a valid token', async () => {
    const token = await signJwt(
      { iss: 'https://app.example', sub: 'user-1', aud: 'https://app.example/api/mcp', jti: 'abc', scopes: ['mcp'] },
      secret,
      3600,
    );
    const res = await verifyJwt(token, secret);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.sub).toBe('user-1');
      expect(res.payload.aud).toBe('https://app.example/api/mcp');
      expect(res.payload.scopes).toEqual(['mcp']);
      expect(res.payload.iss).toBe('https://app.example');
    }
  });

  it('rejects an expired token', async () => {
    const token = await signJwt(
      { iss: 'https://app.example', sub: 'user-1', jti: 'abc' },
      secret,
      0,
    );
    await new Promise((r) => setTimeout(r, 5));
    const res = await verifyJwt(token, secret);
    expect(res.ok).toBe(false);
  });

  it('rejects a token with the wrong secret', async () => {
    const token = await signJwt({ iss: 'x', sub: 'u', jti: 'j1' }, secret, 3600);
    const res = await verifyJwt(token, 'wrong-secret');
    expect(res.ok).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    expect((await verifyJwt('not-a-jwt', secret)).ok).toBe(false);
    expect((await verifyJwt('a.b.c.d.e', secret)).ok).toBe(false);
  });
});

describe('token helpers', () => {
  it('sha256 is deterministic and hex', () => {
    expect(sha256('hello')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256('hello')).toBe(sha256('hello'));
    expect(sha256('hello')).not.toBe(sha256('hell0'));
  });

  it('randomToken is url-safe and unique', () => {
    const a = randomToken(32);
    const b = randomToken(32);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
