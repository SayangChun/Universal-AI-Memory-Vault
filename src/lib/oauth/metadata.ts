// OAuth 2.0 Authorization Server metadata and helpers for the MCP server.
// Implements the parts of the MCP Authorization spec needed by remote
// MCP clients (Claude.ai, ChatGPT developer mode, Gemini Enterprise):
//   - RFC 8414 AS metadata
//   - RFC 9728 protected-resource metadata
//   - RFC 7591 dynamic client registration
//   - PKCE (S256) authorization code + refresh tokens
//   - Pushed Authorization Requests (PAR)
import { appUrl, mcpServerUrl } from '../env';

export interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint: string;
  pushed_authorization_request_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
  authorization_response_iss_parameter_supported: boolean;
  require_pushed_authorization_requests: boolean;
  request_parameter_supported: boolean;
  require_signed_request_object: boolean;
  [key: string]: unknown;
}

export function oauthMetadata(): OAuthMetadata {
  const base = appUrl();
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    pushed_authorization_request_endpoint: `${base}/api/oauth/par`,
    scopes_supported: ['mcp', 'memory:read', 'memory:write'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
    require_pushed_authorization_requests: false,
    request_parameter_supported: false,
    require_signed_request_object: false,
  };
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
}

export function protectedResourceMetadata(): ProtectedResourceMetadata {
  return {
    resource: mcpServerUrl(),
    authorization_servers: [appUrl()],
  };
}

/** Scopes this server recognizes. */
export const SUPPORTED_SCOPES = ['mcp', 'memory:read', 'memory:write'] as const;

export function normalizeScopes(scope: string | undefined | null): string[] {
  if (!scope) return ['mcp'];
  const list = scope.split(/\s+/).filter(Boolean);
  const filtered = list.filter((s) => (SUPPORTED_SCOPES as readonly string[]).includes(s));
  return filtered.length ? [...new Set(filtered)] : ['mcp'];
}

export function scopeString(scopes: string[]): string {
  return [...new Set(scopes)].join(' ');
}
