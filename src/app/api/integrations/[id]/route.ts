import { tryGetAdminClient } from '@/lib/supabase/admin';
import { json, apiError, requireUser, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  try {
    const user = await requireUser();
    const client = tryGetAdminClient();
    if (!client) throw new ApiError(503, 'Supabase is not configured.', 'supabase_required');
    const { id } = await ctx.params;
    const { data, error } = await client
      .from('ai_integrations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new ApiError(404, 'Integration not found', 'not_found');
    return json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

