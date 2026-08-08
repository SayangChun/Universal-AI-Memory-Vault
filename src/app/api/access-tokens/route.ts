import { getAdminClient } from '@/lib/supabase/admin';
import { accessTokenCreateSchema } from '@/lib/validation';
import { json, apiError, requireUser, applyRateLimit } from '@/lib/api';
import { sha256, randomToken } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const client = getAdminClient();

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const { data, error } = await client
      .from('mcp_access_tokens')
      .select('id, name, token_prefix, integration_id, expires_at, created_at, last_used_at, revoked_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return json({ tokens: data });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'access_tokens');
    const body = await request.json().catch(() => null);
    const parsed = accessTokenCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return json({ error: 'invalid_body', message: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
    }
    const token = `umv_${randomToken(32)}`;
    const { data, error } = await client
      .from('mcp_access_tokens')
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        token_hash: sha256(token),
        token_prefix: token.slice(0, 12),
        integration_id: typeof body?.integration_id === 'string' ? body.integration_id : null,
      })
      .select('id, name, token_prefix, integration_id, expires_at, created_at, revoked_at')
      .single();
    if (error) throw new Error(error.message);
    return json({ token: data, secret: token }, 201);
  } catch (err) {
    return apiError(err);
  }
}
