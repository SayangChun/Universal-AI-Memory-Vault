import { getAdminClient } from '@/lib/supabase/admin';
import { AuthorizationServer, OAuthServerError } from '@/lib/oauth/authorization-server';
import { json, errorResponse } from '@/lib/oauth/http';
import { sha256 } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const authServer = new AuthorizationServer(getAdminClient());

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse(new OAuthServerError('invalid_request', 'Expected form-encoded body'));
  const body: Record<string, string> = {};
  for (const [k, v] of form.entries()) body[k] = String(v);

  try {
    const client = await authServer.authenticateClient(body, request.headers.get('authorization'));
    const grantType = String(body.grant_type ?? '');

    if (grantType === 'authorization_code') {
      const code = String(body.code ?? '');
      const redirectUri = String(body.redirect_uri ?? '');
      const verifier = String(body.code_verifier ?? '');
      if (!code) throw new OAuthServerError('invalid_request', 'Missing code');

      const stored = await authServer.consumeAuthCode(code);
      if (!stored) throw new OAuthServerError('invalid_grant', 'Invalid authorization code');
      if (stored.client_id !== client.client_id) {
        throw new OAuthServerError('invalid_grant', 'Code was issued to another client');
      }
      if (redirectUri && stored.redirect_uri !== redirectUri) {
        throw new OAuthServerError('invalid_grant', 'redirect_uri mismatch');
      }
      if (stored.code_challenge) {
        if (!verifier) throw new OAuthServerError('invalid_grant', 'code_verifier required');
        if (sha256(verifier) !== stored.code_challenge) {
          throw new OAuthServerError('invalid_grant', 'Invalid code_verifier (PKCE)');
        }
      }

      const result = await authServer.issueTokens({
        userId: stored.user_id,
        client,
        scopes: stored.scopes,
      });
      return json(result);
    }

    if (grantType === 'refresh_token') {
      const refreshToken = String(body.refresh_token ?? '');
      if (!refreshToken) throw new OAuthServerError('invalid_request', 'Missing refresh_token');
      const result = await authServer.rotateRefreshToken(refreshToken, client);
      return json(result);
    }

    throw new OAuthServerError('unsupported_grant_type', `Unsupported grant_type: ${grantType}`);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(): Promise<Response> {
  return json({ error: 'method_not_allowed', error_description: 'Use POST' }, 405);
}
