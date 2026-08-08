import { getAdminClient } from '@/lib/supabase/admin';
import { MemoryService } from '@/lib/memory/service';
import { SupabaseMemoryRepo } from '@/lib/memory/supabase-repo';
import { json, apiError, requireUser, applyRateLimit, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(new SupabaseMemoryRepo(getAdminClient()));

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'delete_all');
    const body = await request.json().catch(() => null);
    if (body?.confirm !== 'DELETE_ALL') {
      throw new ApiError(400, 'Deleting ALL memories requires { "confirm": "DELETE_ALL" }', 'confirm_required');
    }
    const count = await service.deleteAll(user.id, { provider: 'manual' });
    return json({ ok: true, deleted: count });
  } catch (err) {
    return apiError(err);
  }
}
