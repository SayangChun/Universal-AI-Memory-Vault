// Shared HTTP helpers for the OAuth endpoints.
import { OAuthServerError } from './authorization-server';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof OAuthServerError) {
    return json(err.toBody(), err.status);
  }
  if (err instanceof Error) {
    return json({ error: 'server_error', error_description: err.message }, 500);
  }
  return json({ error: 'server_error', error_description: 'Unknown error' }, 500);
}

export function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
