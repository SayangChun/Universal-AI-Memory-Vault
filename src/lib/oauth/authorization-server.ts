// OAuth 2.0 Authorization Server implementation backing the MCP server.
// Issues short-lived HS256 access tokens bound to a user_id, plus rotating
// refresh tokens. Clients authenticate with PKCE (S256) as public clients,
// or with client_secret_post / client_secret_basic as confidential clients.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv, appUrl, mcpServerUrl } from '../env';
import { signJwt, generateJti } from '../jwt';
import { sha256, randomToken } from '../utils';
import { normalizeScopes, scopeString } from './metadata';

export class OAuthServerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly description?: string,
  ) {
    super(message);
  }
  toBody(): Record<string, unknown> {
    return { error: this.code, error_description: this.description ?? this.message };
  }
}

export interface StoredClient {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string | null;
  client_uri: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  provider: string | null;
  created_at: string;
}

export interface StoredCode {
  code_hash: string;
  user_id: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scopes: string[];
  expires_at: string;
  used_at: string | null;
}

interface TokenResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export function guessProviderFromClientName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/claude|anthropic/.test(n)) return 'claude';
  if (/chatgpt|openai|codex/.test(n)) return 'chatgpt';
  if (/gemini|google/.test(n)) return 'gemini';
  return null;
}

export class AuthorizationServer {
  constructor(private readonly client: SupabaseClient) {}

  // ---- client management ----------------------------------------

  async getClient(clientId: string): Promise<StoredClient | null> {
    if (!clientId) return null;
    const { data, error } = await this.client
      .from('mcp_oauth_clients')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error) throw new OAuthServerError('server_error', 'Failed to load client', 500);
    if (!data) return null;
    return mapClient(data);
  }

  async registerClient(metadata: Record<string, unknown>): Promise<Record<string, unknown>> {
    const redirectUris = asStringArray(metadata.redirect_uris);
    if (!redirectUris.length) {
      throw new OAuthServerError('invalid_client_metadata', 'redirect_uris is required', 400);
    }
    for (const uri of redirectUris) {
      if (!isValidRedirectUri(uri)) {
        throw new OAuthServerError('invalid_redirect_uri', `invalid redirect_uri: ${uri}`, 400);
      }
    }

    const method = String(metadata.token_endpoint_auth_method ?? 'none');
    const grantTypes = asStringArray(metadata.grant_types).length
      ? asStringArray(metadata.grant_types)
      : ['authorization_code', 'refresh_token'];
    const responseTypes = asStringArray(metadata.response_types).length
      ? asStringArray(metadata.response_types)
      : ['code'];
    const wantsSecret = method === 'client_secret_post' || method === 'client_secret_basic';

    const clientId = randomToken(16);
    const clientSecret = wantsSecret ? randomToken(32) : undefined;
    const name = typeof metadata.client_name === 'string' ? metadata.client_name.slice(0, 200) : null;
    const uri = typeof metadata.client_uri === 'string' ? metadata.client_uri.slice(0, 500) : null;

    const { error } = await this.client.from('mcp_oauth_clients').insert({
      client_id: clientId,
      client_secret_hash: clientSecret ? sha256(clientSecret) : null,
      client_name: name,
      client_uri: uri,
      redirect_uris: JSON.stringify(redirectUris),
      grant_types: JSON.stringify(grantTypes),
      response_types: JSON.stringify(responseTypes),
      token_endpoint_auth_method: method,
      provider: guessProviderFromClientName(name),
    });
    if (error) {
      throw new OAuthServerError('server_error', 'Failed to register client: ' + error.message, 500);
    }

    const info: Record<string, unknown> = {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: method,
      grant_types: grantTypes,
      response_types: responseTypes,
      redirect_uris: redirectUris,
      client_name: name ?? undefined,
      client_uri: uri ?? undefined,
    };
    if (clientSecret) info.client_secret = clientSecret;
    return info;
  }

  /**
   * Authenticate a client at the token/revocation endpoints.
   * Supports public (PKCE) clients and client_secret_post/basic.
   */
  async authenticateClient(
    body: Record<string, unknown>,
    authHeader?: string | null,
  ): Promise<StoredClient> {
    const clientId = String(body.client_id ?? '');
    const secret = String(body.client_secret ?? '');

    if (!clientId && authHeader?.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const sep = decoded.indexOf(':');
        if (sep < 0) throw new Error('bad basic');
        const id = decoded.slice(0, sep);
        const pw = decoded.slice(sep + 1);
        return this.verifyClientCredentials(id, pw);
      } catch {
        throw new OAuthServerError('invalid_client', 'Invalid client authentication', 401);
      }
    }

    if (!clientId) {
      throw new OAuthServerError('invalid_client', 'Missing client_id', 401);
    }
    return this.verifyClientCredentials(clientId, secret);
  }

  private async verifyClientCredentials(clientId: string, secret: string): Promise<StoredClient> {
    const client = await this.getClient(clientId);
    if (!client) throw new OAuthServerError('invalid_client', 'Unknown client', 401);
    if (client.token_endpoint_auth_method === 'none') {
      if (client.client_secret_hash) {
        throw new OAuthServerError('invalid_client', 'Client requires a secret', 401);
      }
      return client;
    }
    if (!secret || !client.client_secret_hash || sha256(secret) !== client.client_secret_hash) {
      throw new OAuthServerError('invalid_client', 'Invalid client credentials', 401);
    }
    return client;
  }

  // ---- pushed authorization requests ----------------------------

  async storePar(params: Record<string, unknown>): Promise<string> {
    const token = randomToken(16);
    const requestUri = `urn:ietf:params:oauth:request_uri:${token}`;
    const { error } = await this.client.from('mcp_oauth_par').insert({
      request_uri: requestUri,
      request_uri_hash: sha256(requestUri),
      params: JSON.stringify(params),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) {
      throw new OAuthServerError('server_error', 'Failed to store PAR request', 500);
    }
    return requestUri;
  }

  async getPar(requestUri: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.client
      .from('mcp_oauth_par')
      .select('params, expires_at')
      .eq('request_uri_hash', sha256(requestUri))
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return JSON.parse(data.params);
  }

  // ---- authorization codes ---------------------------------------

  async createAuthCode(args: {
    userId: string;
    client: StoredClient;
    redirectUri: string;
    codeChallenge: string;
    scopes: string[];
  }): Promise<string> {
    const code = randomToken(32);
    const { error } = await this.client.from('mcp_oauth_codes').insert({
      code_hash: sha256(code),
      user_id: args.userId,
      client_id: args.client.client_id,
      redirect_uri: args.redirectUri,
      code_challenge: args.codeChallenge,
      scopes: JSON.stringify(args.scopes),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) {
      throw new OAuthServerError('server_error', 'Failed to create authorization code', 500);
    }
    return code;
  }

  async consumeAuthCode(code: string): Promise<StoredCode | null> {
    const { data, error } = await this.client
      .from('mcp_oauth_codes')
      .select('*')
      .eq('code_hash', sha256(code))
      .maybeSingle();
    if (error || !data) return null;
    const stored: StoredCode = {
      code_hash: data.code_hash,
      user_id: data.user_id,
      client_id: data.client_id,
      redirect_uri: data.redirect_uri,
      code_challenge: data.code_challenge,
      scopes: JSON.parse(data.scopes),
      expires_at: data.expires_at,
      used_at: data.used_at,
    };
    if (stored.used_at) return null; // single-use
    if (new Date(stored.expires_at).getTime() < Date.now()) return null;
    await this.client.from('mcp_oauth_codes').update({ used_at: new Date().toISOString() }).eq('code_hash', data.code_hash);
    return stored;
  }

  // ---- tokens -----------------------------------------------------

  async issueTokens(args: {
    userId: string;
    client: StoredClient;
    scopes: string[];
  }): Promise<TokenResult> {
    const env = getServerEnv();
    if (!env.mcpOauthSecret) {
      throw new OAuthServerError('server_error', 'MCP_OAUTH_SECRET is not configured', 500);
    }
    const ttl = env.mcpAccessTokenTtl;
    const accessToken = await signJwt(
      {
        iss: appUrl(),
        sub: args.userId,
        aud: mcpServerUrl(),
        client_id: args.client.client_id,
        scopes: args.scopes,
        jti: generateJti(),
      },
      env.mcpOauthSecret,
      ttl,
    );
    const refreshToken = randomToken(48);
    const { error } = await this.client.from('mcp_oauth_tokens').insert({
      user_id: args.userId,
      client_id: args.client.client_id,
      provider: args.client.provider,
      scopes: JSON.stringify(args.scopes),
      refresh_token_hash: sha256(refreshToken),
      expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    });
    if (error) {
      throw new OAuthServerError('server_error', 'Failed to store refresh token', 500);
    }
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ttl,
      refresh_token: refreshToken,
      scope: scopeString(args.scopes),
    };
  }

  async rotateRefreshToken(refreshToken: string, client: StoredClient): Promise<TokenResult> {
    const hash = sha256(refreshToken);
    const { data, error } = await this.client
      .from('mcp_oauth_tokens')
      .select('*')
      .eq('refresh_token_hash', hash)
      .maybeSingle();
    if (error || !data) {
      throw new OAuthServerError('invalid_grant', 'Invalid refresh token', 400);
    }
    if (data.revoked_at) {
      throw new OAuthServerError('invalid_grant', 'Refresh token has been revoked', 400);
    }
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      throw new OAuthServerError('invalid_grant', 'Refresh token has expired', 400);
    }
    if (data.client_id !== client.client_id) {
      throw new OAuthServerError('invalid_grant', 'Refresh token was issued to another client', 400);
    }

    // rotate: revoke old, issue new
    await this.client.from('mcp_oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('refresh_token_hash', hash);

    const scopes = normalizeScopes(typeof data.scopes === 'string' ? data.scopes : undefined);
    const result = await this.issueTokens({
      userId: data.user_id,
      client: { ...client, provider: client.provider ?? data.provider ?? null },
      scopes,
    });
    return result;
  }

  async revokeToken(token: string, client: StoredClient): Promise<void> {
    // refresh token revocation
    const hash = sha256(token);
    const { data, error } = await this.client
      .from('mcp_oauth_tokens')
      .select('id, client_id')
      .eq('refresh_token_hash', hash)
      .maybeSingle();
    if (!error && data) {
      if (data.client_id === client.client_id) {
        await this.client.from('mcp_oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', data.id);
      }
      return;
    }
    // access token revocation (record jti in the revocation list)
    const parts = token.split('.');
    if (parts.length === 3) {
      const env = getServerEnv();
      try {
        const { verifyJwt } = await import('../jwt');
        const res = await verifyJwt(token, env.mcpOauthSecret);
        if (res.ok) {
          await this.client.from('mcp_oauth_revoked_jti').upsert(
            { jti: res.payload.jti, client_id: client.client_id, expires_at: new Date((res.payload.exp ?? 0) * 1000).toISOString() },
            { onConflict: 'jti' },
          );
        }
      } catch {
        // ignore
      }
    }
  }
}

function mapClient(d: Record<string, unknown>): StoredClient {
  return {
    client_id: String(d.client_id),
    client_secret_hash: d.client_secret_hash ? String(d.client_secret_hash) : null,
    client_name: d.client_name ? String(d.client_name) : null,
    client_uri: d.client_uri ? String(d.client_uri) : null,
    redirect_uris: asStringArray(d.redirect_uris),
    grant_types: asStringArray(d.grant_types),
    response_types: asStringArray(d.response_types),
    token_endpoint_auth_method: String(d.token_endpoint_auth_method ?? 'none'),
    provider: d.provider ? String(d.provider) : null,
    created_at: String(d.created_at ?? ''),
  };
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

function isValidRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === 'http:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return false;
    if (!u.protocol.startsWith('https') && u.protocol !== 'http:') return false;
    return true;
  } catch {
    return false;
  }
}

export function validCodeChallengeMethod(method: string | undefined | null): boolean {
  return method === 'S256' || method === undefined || method === null;
}
