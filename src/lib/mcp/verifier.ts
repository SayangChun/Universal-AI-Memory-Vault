// MCP resource-server token verification.
// Accepts two kinds of Bearer tokens:
//   1. Access tokens issued by our OAuth Authorization Server (HS256 JWT).
//   2. Personal MCP access tokens created by the user in the dashboard
//      (hashed in the `mcp_access_tokens` table) — for programmatic/stdio
//      clients and API testing.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv, mcpServerUrl } from '../env';
import { verifyJwt } from '../jwt';
import { sha256 } from '../utils';

export interface McpPrincipal {
  userId: string;
  provider: string;
  integrationId?: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  tokenType: 'oauth' | 'personal';
}

export class McpAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 401,
  ) {
    super(message);
  }
}

export async function verifyMcpToken(token: string, client: SupabaseClient): Promise<McpPrincipal> {
  const env = getServerEnv();

  // 1) OAuth JWT access token
  if (token.split('.').length === 3 && env.mcpOauthSecret) {
    const res = await verifyJwt(token, env.mcpOauthSecret);
    if (res.ok) {
      const payload = res.payload;
      // Reject tokens minted for a different resource server.
      const aud = payload.aud;
      if (typeof aud === 'string' && aud && aud !== mcpServerUrl() && !mcpServerUrl().startsWith(aud)) {
        throw new McpAuthError('Token was issued for a different resource', 'invalid_token');
      }
      // Check revocation list.
      const { data: revoked } = await client
        .from('mcp_oauth_revoked_jti')
        .select('jti')
        .eq('jti', payload.jti)
        .maybeSingle();
      if (revoked) {
        throw new McpAuthError('Token has been revoked', 'invalid_token');
      }

      let provider: string = 'other';
      const { data: clientRow } = await client
        .from('mcp_oauth_clients')
        .select('provider')
        .eq('client_id', String(payload.client_id ?? ''))
        .maybeSingle();
      if (clientRow?.provider) provider = String(clientRow.provider);

      return {
        userId: String(payload.sub),
        provider,
        clientId: String(payload.client_id ?? 'oauth'),
        scopes: Array.isArray(payload.scopes) ? (payload.scopes as string[]) : ['mcp'],
        expiresAt: payload.exp,
        tokenType: 'oauth',
      };
    }
    // Not a valid JWT — fall through to personal-token lookup rather than
    // returning immediately, so personal tokens that look like JWTs still work.
  }

  // 2) Personal access token
  const hash = sha256(token);
  const { data: tokenRow, error } = await client
    .from('mcp_access_tokens')
    .select('id, integration_id, revoked_at, expires_at')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error) {
    throw new McpAuthError('Failed to verify token', 'server_error', 500);
  }

  if (tokenRow) {
    if (tokenRow.revoked_at) {
      throw new McpAuthError('Token has been revoked', 'invalid_token');
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
      throw new McpAuthError('Token has expired', 'invalid_token');
    }
    // Refresh last_used_at (best effort).
    void client.from('mcp_access_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id);

    let provider: string = 'other';
    let integrationId: string | undefined;
    if (tokenRow.integration_id) {
      const { data: integration } = await client
        .from('ai_integrations')
        .select('id, provider')
        .eq('id', tokenRow.integration_id)
        .maybeSingle();
      if (integration) {
        provider = integration.provider ? String(integration.provider) : 'other';
        integrationId = String(integration.id);
      }
    }

    // The personal token does not carry the user id in the hash; the row is
    // per-user, so this lookup gives us the owner.
    const { data: owner } = await client
      .from('mcp_access_tokens')
      .select('user_id')
      .eq('id', tokenRow.id)
      .maybeSingle();

    return {
      userId: String(owner?.user_id ?? ''),
      provider,
      integrationId,
      clientId: `personal:${tokenRow.id}`,
      scopes: ['mcp', 'memory:read', 'memory:write'],
      tokenType: 'personal',
    };
  }

  throw new McpAuthError('Invalid access token', 'invalid_token');
}

/** Resolve the ActorContext provider from a verified principal. */
export function principalToActor(p: McpPrincipal): {
  userId: string;
  provider: string;
  integrationId?: string;
} {
  return { userId: p.userId, provider: p.provider, integrationId: p.integrationId };
}
