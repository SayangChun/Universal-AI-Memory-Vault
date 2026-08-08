import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationServer, OAuthServerError } from '@/lib/oauth/authorization-server';
import { oauthMetadata, protectedResourceMetadata } from '@/lib/oauth/metadata';
import { verifyJwt } from '@/lib/jwt';
import { sha256 } from '@/lib/utils';

process.env.MCP_OAUTH_SECRET = 'test-oauth-secret';
process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
process.env.MCP_SERVER_URL = 'https://app.example.com/api/mcp';

type Row = Record<string, unknown>;
type Query = {
  from: (table: string) => {
    insert: (v: Row) => Promise<{ error: null }>;
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: Row | null; error: null }>;
        single: () => Promise<{ data: Row | null; error: null }>;
      };
      order: () => unknown;
    };
    update: (v: Row) => { eq: (col: string, val: unknown) => Promise<{ error: null }> };
    upsert: (v: Row, opts?: { onConflict?: string }) => Promise<{ error: null }>;
    delete: () => unknown;
  };
};

function makeClient(store: Map<string, Row[]>): Query {
  return {
    from(table: string) {
      const rows = store.get(table) ?? [];
      store.set(table, rows);
      return {
        async insert(v: Row) {
          rows.push({ ...v });
          return { error: null };
        },
        select(_cols: string) {
          return {
            eq(col: string, val: unknown) {
              const match = rows.filter((r) => r[col] === val);
              return {
                async maybeSingle() {
                  return { data: match[0] ?? null, error: null };
                },
                async single() {
                  if (!match[0]) return { data: null, error: { message: 'not found' } as never };
                  return { data: match[0], error: null };
                },
              };
            },
            order() {
              return this;
            },
          };
        },
        update(v: Row) {
          return {
            async eq(col: string, val: unknown) {
              for (const r of rows) if (r[col] === val) Object.assign(r, v);
              return { error: null };
            },
          };
        },
        async upsert(v: Row, opts?: { onConflict?: string }) {
          if (opts?.onConflict) {
            const idx = rows.findIndex((r) => r[opts.onConflict!] === v[opts.onConflict!]);
            if (idx >= 0) rows[idx] = { ...rows[idx], ...v };
            else rows.push(v);
          } else {
            rows.push(v);
          }
          return { error: null };
        },
        delete() {
          return this;
        },
      };
    },
  };
}

describe('AuthorizationServer', () => {
  let store: Map<string, Row[]>;
  let server: AuthorizationServer;

  beforeEach(() => {
    store = new Map();
    server = new AuthorizationServer(makeClient(store) as never);
  });

  it('publishes RFC 8414 + RFC 9728 metadata', () => {
    const m = oauthMetadata();
    expect(m.issuer).toBe('https://app.example.com');
    expect(m.authorization_endpoint).toBe('https://app.example.com/api/oauth/authorize');
    expect(m.token_endpoint).toBe('https://app.example.com/api/oauth/token');
    expect(m.code_challenge_methods_supported).toContain('S256');

    const p = protectedResourceMetadata();
    expect(p.resource).toBe('https://app.example.com/api/mcp');
    expect(p.authorization_servers).toContain('https://app.example.com');
  });

  it('registers a public (PKCE) client', async () => {
    const info = await server.registerClient({
      client_name: 'Claude Desktop',
      client_uri: 'https://claude.ai',
      redirect_uris: ['https://claude.ai/oauth/callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(info.client_id).toBeTruthy();
    expect(info.token_endpoint_auth_method).toBe('none');
    expect(info.client_secret).toBeUndefined();
    // provider guessed from name
    expect(store.get('mcp_oauth_clients')![0].provider).toBe('claude');
  });

  it('registers a confidential client and issues a secret', async () => {
    const info = await server.registerClient({
      client_name: 'My App',
      redirect_uris: ['https://app.local/callback'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
    expect(info.client_secret).toBeTruthy();
  });

  it('rejects invalid redirect URIs', async () => {
    await expect(
      server.registerClient({ client_name: 'Bad', redirect_uris: ['http://evil.com/cb'], token_endpoint_auth_method: 'none' }),
    ).rejects.toThrow();
  });

  it('runs the full authorization-code + PKCE + refresh flow', async () => {
    const clientInfo = (await server.registerClient({
      client_name: 'Test Client',
      redirect_uris: ['https://client.example/callback'],
    })) as Record<string, unknown>;
    const clientId = String(clientInfo.client_id);
    const stored = store.get('mcp_oauth_clients')![0];

    const code = await server.createAuthCode({
      userId: 'user-1',
      client: { ...stored } as never,
      redirectUri: 'https://client.example/callback',
      codeChallenge: sha256('verifier'),
      scopes: ['mcp'],
    });
    expect(code).toBeTruthy();

    const tokens = await server.issueTokens({ userId: 'user-1', client: stored as never, scopes: ['mcp'] });
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();

    // access token is a verifiable JWT bound to the user
    const res = await verifyJwt(tokens.access_token, 'test-oauth-secret');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.sub).toBe('user-1');
      expect(res.payload.client_id).toBe(clientId);
      expect(res.payload.scopes).toEqual(['mcp']);
    }

    // refresh token rotation revokes the old one
    const rotated = await server.rotateRefreshToken(tokens.refresh_token, stored as never);
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);

    // old refresh token is now invalid
    await expect(server.rotateRefreshToken(tokens.refresh_token, stored as never)).rejects.toThrow();
  });

  it('authorization codes are single-use', async () => {
    const info = (await server.registerClient({
      client_name: 'Test Client',
      redirect_uris: ['https://client.example/callback'],
    })) as Record<string, unknown>;
    const client = await server.authenticateClient({ client_id: String(info.client_id), client_secret: '' });
    expect(client.client_id).toBe(info.client_id);
    expect(client.token_endpoint_auth_method).toBe('none');

    const code = await server.createAuthCode({
      userId: 'user-1',
      client,
      redirectUri: 'https://client.example/callback',
      codeChallenge: sha256('verifier'),
      scopes: ['mcp'],
    });
    const first = await server.consumeAuthCode(code);
    expect(first).not.toBeNull();
    // single-use: second consume returns null
    const second = await server.consumeAuthCode(code);
    expect(second).toBeNull();
  });

  it('authenticates confidential clients via client_secret', async () => {
    const info = (await server.registerClient({
      client_name: 'Secret App',
      redirect_uris: ['https://secret.example/cb'],
      token_endpoint_auth_method: 'client_secret_post',
    })) as Record<string, unknown>;

    const ok = await server.authenticateClient({
      client_id: String(info.client_id),
      client_secret: String(info.client_secret),
    });
    expect(ok.client_id).toBe(info.client_id);

    await expect(
      server.authenticateClient({ client_id: String(info.client_id), client_secret: 'wrong' }),
    ).rejects.toThrow(OAuthServerError);
  });
});
