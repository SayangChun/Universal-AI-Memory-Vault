// OAuth authorization endpoint (RFC 6749 §3.1).
// Single-user platform: no sign-in step, renders a consent page and
// redirects back with a PKCE auth code on approval.
import { getSessionUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { AuthorizationServer, OAuthServerError } from '@/lib/oauth/authorization-server';
import { json, errorResponse, html } from '@/lib/oauth/http';
import { appUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

const authServer = new AuthorizationServer(getAdminClient());

interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  response_type: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function resolveParams(searchParams: URLSearchParams): Promise<AuthorizeParams> {
  const requestUri = searchParams.get('request_uri');
  const stored: Record<string, string> = {};
  if (requestUri) {
    const par = await authServer.getPar(requestUri);
    if (!par) throw new OAuthServerError('invalid_request_uri', 'Unknown or expired request_uri');
    for (const [k, v] of Object.entries(par)) stored[k] = String(v);
  }
  const get = (k: string): string => searchParams.get(k) ?? stored[k] ?? '';
  return {
    client_id: get('client_id'),
    redirect_uri: get('redirect_uri'),
    scope: get('scope'),
    state: get('state'),
    code_challenge: get('code_challenge'),
    code_challenge_method: get('code_challenge_method'),
    response_type: get('response_type'),
  };
}

async function validate(p: AuthorizeParams): Promise<{ clientId: string; redirectUri: string; scopes: string[] }> {
  if (!p.client_id) throw new OAuthServerError('invalid_request', 'Missing client_id');
  if (p.response_type && p.response_type !== 'code') {
    throw new OAuthServerError('unsupported_response_type', `Unsupported response_type: ${p.response_type}`);
  }
  if (p.code_challenge && p.code_challenge_method && p.code_challenge_method !== 'S256') {
    throw new OAuthServerError('invalid_request', 'Only S256 code_challenge_method is supported');
  }
  const client = await authServer.getClient(p.client_id);
  if (!client) throw new OAuthServerError('unauthorized_client', 'Unknown client_id');
  if (!p.redirect_uri) throw new OAuthServerError('invalid_request', 'Missing redirect_uri');
  if (!client.redirect_uris.includes(p.redirect_uri)) {
    throw new OAuthServerError('invalid_redirect_uri', 'redirect_uri is not registered for this client');
  }
  const scopes = (p.scope || 'mcp').split(/\s+/).filter(Boolean);
  return { clientId: client.client_id, redirectUri: p.redirect_uri, scopes };
}

function consentHtml(p: AuthorizeParams, clientName: string, email: string): string {
  const scopeList = (p.scope || 'mcp')
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => esc(s))
    .join(', ');
  const fields = [
    ['client_id', p.client_id],
    ['redirect_uri', p.redirect_uri],
    ['scope', p.scope],
    ['state', p.state],
    ['code_challenge', p.code_challenge],
    ['code_challenge_method', p.code_challenge_method],
    ['response_type', p.response_type],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<input type="hidden" name="${esc(k!)}" value="${esc(v!)}" />`)
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Authorize AI access</title>
<style>
  body{background:#0a0f1c;color:#e5e9f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px}
  .card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px;max-width:480px;width:100%}
  h1{font-size:20px;margin:0 0 4px} p{color:#9ca3af;font-size:14px;line-height:1.6;margin:6px 0}
  .app{font-weight:600;color:#60a5fa} .scopes{background:#0f172a;border:1px solid #1f2937;border-radius:8px;
    padding:10px 12px;font-size:13px;margin:16px 0}
  .btns{display:flex;gap:12px;margin-top:24px}
  button{flex:1;padding:10px 0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:none}
  .allow{background:#2563eb;color:#fff} .deny{background:transparent;color:#9ca3af;border:1px solid #374151}
  .muted{color:#6b7280;font-size:12px}
</style></head><body>
<form method="post" class="card" action="/api/oauth/authorize">
  ${fields}
  <h1>Authorize AI connection</h1>
  <p class="app">${esc(clientName)}</p>
  <p>wants to access your personal memory vault. Signed in as <b>${esc(email)}</b>.</p>
  <div class="scopes">Requested access: <b>${scopeList || 'mcp'}</b></div>
  <p class="muted">Your memories stay on your server. The AI can search, read, create, update and delete memories
  through the MCP interface. You can revoke access any time in Settings.</p>
  <div class="btns">
    <button type="submit" name="consent" value="yes" class="allow">Allow</button>
    <button type="submit" name="consent" value="no" class="deny">Deny</button>
  </div>
</form></body></html>`;
}

function redirectError(redirectUri: string, state: string, error: string, description: string): Response {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  return Response.redirect(url.toString(), 302);
}

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  const url = new URL(request.url);

  let params: AuthorizeParams;
  try {
    params = await resolveParams(url.searchParams);
  } catch (err) {
    return errorResponse(err);
  }

  try {
    const { clientId } = await validate(params);
    const client = await authServer.getClient(clientId);
    return html(consentHtml(params, client?.client_name ?? 'this application', user.email ?? 'owner'));
  } catch (err) {
    if (err instanceof OAuthServerError) {
      // If we know the redirect target, return the error there per RFC 6749.
      return redirectError(params?.redirect_uri ?? '', params?.state ?? '', err.code, err.description ?? err.message);
    }
    return errorResponse(err);
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSessionUser();

  const form = await request.formData().catch(() => null);
  const get = (k: string): string => String(form?.get(k) ?? '');

  let params: AuthorizeParams;
  try {
    params = await resolveParams(new URLSearchParams());
    // POST form carries the full param set as hidden inputs.
    params = {
      client_id: get('client_id'),
      redirect_uri: get('redirect_uri'),
      scope: get('scope'),
      state: get('state'),
      code_challenge: get('code_challenge'),
      code_challenge_method: get('code_challenge_method'),
      response_type: get('response_type'),
    };
  } catch (err) {
    return errorResponse(err);
  }

  const consent = get('consent');
  if (consent !== 'yes') {
    // Denied.
    return redirectError(params.redirect_uri, params.state, 'access_denied', 'User denied the request');
  }

  try {
    const { clientId, redirectUri, scopes } = await validate(params);
    if (!params.code_challenge) {
      return redirectError(redirectUri, params.state, 'invalid_request', 'code_challenge is required (PKCE)');
    }
    const client = await authServer.getClient(clientId);
    if (!client) throw new OAuthServerError('unauthorized_client', 'Unknown client_id');
    const code = await authServer.createAuthCode({
      userId: user.id,
      client,
      redirectUri,
      codeChallenge: params.code_challenge,
      scopes,
    });

    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    if (params.state) target.searchParams.set('state', params.state);
    target.searchParams.set('iss', appUrl());
    return Response.redirect(target.toString(), 302);
  } catch (err) {
    if (err instanceof OAuthServerError) {
      return redirectError(params.redirect_uri, params.state, err.code, err.description ?? err.message);
    }
    return json({ error: 'server_error' }, 500);
  }
}
