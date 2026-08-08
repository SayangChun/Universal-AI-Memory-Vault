import { getAdminClient } from '@/lib/supabase/admin';
import { json, apiError, requireUser } from '@/lib/api';

export const dynamic = 'force-dynamic';

const client = getAdminClient();

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50) || 50, 1), 200);
    const memoryId = url.searchParams.get('memory_id');

    let query = client
      .from('audit_logs')
      .select('id, action, source_provider, memory_id, detail, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (memoryId) query = query.eq('memory_id', memoryId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return json({ entries: data });
  } catch (err) {
    return apiError(err);
  }
}
