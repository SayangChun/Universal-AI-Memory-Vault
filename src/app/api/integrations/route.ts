import { tryGetAdminClient } from '@/lib/supabase/admin';
import { providerSchema } from '@/lib/validation';
import { json, apiError, requireUser, applyRateLimit, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const client = tryGetAdminClient();
    if (!client) return json({ integrations: [] });

    const { data, error } = await client
      .from('ai_integrations')
      .select('id, provider, name, status, credential_type, meta, created_at, updated_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return json({ integrations: data });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'integrations');
    const client = tryGetAdminClient();
    if (!client) throw new ApiError(503, 'Supabase is not configured. Integrations require a real database.', 'supabase_required');

    const body = await request.json().catch(() => null);
    const provider = providerSchema.safeParse(body?.provider);
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : null;

    const { data, error } = await client
      .from('ai_integrations')
      .insert({
        user_id: user.id,
        provider: provider.success ? provider.data : 'other',
        name: name ?? 'Connected AI',
        status: 'connected',
        credential_type: 'mcp_oauth',
        meta: typeof body?.meta === 'object' && body.meta ? body.meta : {},
      })
      .select('id, provider, name, status, credential_type, meta, created_at, updated_at, last_used_at')
      .single();
    if (error) throw new Error(error.message);
    return json({ integration: data }, 201);
  } catch (err) {
    return apiError(err);
  }
}

