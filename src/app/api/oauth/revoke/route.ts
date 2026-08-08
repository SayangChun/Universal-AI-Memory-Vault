import { getAdminClient } from '@/lib/supabase/admin';
import { AuthorizationServer } from '@/lib/oauth/authorization-server';
import { json, errorResponse } from '@/lib/oauth/http';

export const dynamic = 'force-dynamic';

const authServer = new AuthorizationServer(getAdminClient());

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const body: Record<string, string> = {};
  if (form) {
    for (const [k, v] of form.entries()) body[k] = String(v);
  } else {
    const parsed = await request.json().catch(() => null);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) body[k] = String(v);
    }
  }
  const token = body.token ?? body.access_token ?? '';
  if (!token) {
    return json({ error: 'invalid_request', error_description: 'Missing token' }, 400);
  }
  try {
    const client = await authServer.authenticateClient(body, request.headers.get('authorization'));
    await authServer.revokeToken(token, client);
    return new Response(null, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
