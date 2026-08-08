// MCP resource endpoint (Streamable HTTP, 2026-07-28 spec).
//
// - POST /api/mcp   JSON-RPC MCP exchanges (tools/list, tools/call, …)
// - GET  /api/mcp   used for `server/discover` probes and metadata
//
// Authentication: Bearer token verified via requireBearerAuth. Both OAuth
// access tokens (JWT from our AS) and personal access tokens are accepted.
import { requireBearerAuth, getOAuthProtectedResourceMetadataUrl, OAuthError } from '@modelcontextprotocol/server';
import type { AuthInfo, OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { tryGetAdminClient } from '@/lib/supabase/admin';
import { memoryMcpHandler } from '@/lib/mcp/server';
import { verifyMcpToken, McpAuthError } from '@/lib/mcp/verifier';
import { mcpServerUrl } from '@/lib/env';

const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const client = tryGetAdminClient();
    if (!client) {
      throw new OAuthError('access_denied', 'Supabase is not configured; MCP authentication is unavailable.');
    }
    try {
      const principal = await verifyMcpToken(token, client);
      return {
        token,
        clientId: principal.clientId,
        scopes: principal.scopes,
        expiresAt: principal.expiresAt,
        resource: new URL(mcpServerUrl()),
        extra: {
          userId: principal.userId,
          provider: principal.provider,
          integrationId: principal.integrationId,
        },
      };
    } catch (err) {
      if (err instanceof McpAuthError) {
        throw new OAuthError(err.code, err.message);
      }
      throw err;
    }
  },
};

const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(mcpServerUrl()));

const gate = requireBearerAuth({
  verifier,
  requiredScopes: ['mcp'],
  resourceMetadataUrl,
});


export async function POST(request: Request): Promise<Response> {
  const auth: AuthInfo | Response = await gate(request);
  if (auth instanceof Response) return auth;
  return memoryMcpHandler.fetch(request, { authInfo: auth });
}

export async function GET(request: Request): Promise<Response> {
  return memoryMcpHandler.fetch(request);
}

export async function PUT(request: Request): Promise<Response> {
  return memoryMcpHandler.fetch(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return memoryMcpHandler.fetch(request);
}

export const dynamic = 'force-dynamic';
