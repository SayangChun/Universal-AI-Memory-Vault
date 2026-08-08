import { getAdminClient } from '@/lib/supabase/admin';
import { MemoryService } from '@/lib/memory/service';
import { SupabaseMemoryRepo } from '@/lib/memory/supabase-repo';
import { json, apiError, requireUser, applyRateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(new SupabaseMemoryRepo(getAdminClient()));

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'stats');
    const stats = await service.stats(user.id);
    return json({ stats });
  } catch (err) {
    return apiError(err);
  }
}
