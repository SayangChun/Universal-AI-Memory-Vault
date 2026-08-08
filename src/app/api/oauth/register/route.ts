import { getAdminClient } from '@/lib/supabase/admin';
import { AuthorizationServer } from '@/lib/oauth/authorization-server';
import { json, errorResponse } from '@/lib/oauth/http';

export const dynamic = 'force-dynamic';

const authServer = new AuthorizationServer(getAdminClient());

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse(new Error('Expected JSON object'));
  }
  try {
    const info = await authServer.registerClient(body as Record<string, unknown>);
    return json(info, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
