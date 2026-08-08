import { tryGetAdminClient } from '@/lib/supabase/admin';
import { AuthorizationServer } from '@/lib/oauth/authorization-server';
import { json, errorResponse } from '@/lib/oauth/http';

export const dynamic = 'force-dynamic';

let _authServer: AuthorizationServer | null = null;
function getAuthServer(): AuthorizationServer {
  if (!_authServer) {
    const client = tryGetAdminClient();
    if (!client) throw new Error('Supabase is not configured; OAuth is unavailable in demo mode.');
    _authServer = new AuthorizationServer(client);
  }
  return _authServer;
}

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse(new Error('Expected form-encoded body'));
  const body: Record<string, string> = {};
  for (const [k, v] of form.entries()) body[k] = String(v);

  try {
    const client = await getAuthServer().authenticateClient(body, request.headers.get('authorization'));
    if (body.client_id && body.client_id !== client.client_id) {
      throw new Error('client_id mismatch');
    }
    const requestUri = await getAuthServer().storePar(body);
    return json({ request_uri: requestUri, expires_in: 600 }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

