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
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse(new Error('Expected JSON object'));
  }
  try {
    const info = await getAuthServer().registerClient(body as Record<string, unknown>);
    return json(info, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

