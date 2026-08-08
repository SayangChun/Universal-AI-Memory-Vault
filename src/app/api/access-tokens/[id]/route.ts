import { getAdminClient } from '@/lib/supabase/admin';
import { json, apiError, requireUser, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const client = getAdminClient();

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { data, error } = await client
      .from('mcp_access_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('revoked_at', null)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new ApiError(404, 'Token not found', 'not_found');
    return json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
