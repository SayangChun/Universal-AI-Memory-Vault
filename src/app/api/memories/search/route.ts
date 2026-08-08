import { getAdminClient } from '@/lib/supabase/admin';
import { MemoryService } from '@/lib/memory/service';
import { SupabaseMemoryRepo } from '@/lib/memory/supabase-repo';
import { memorySearchSchema } from '@/lib/validation';
import { json, apiError, requireUser, applyRateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(new SupabaseMemoryRepo(getAdminClient()));

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'search');
    const url = new URL(request.url);
    const opts = memorySearchSchema.parse(Object.fromEntries(url.searchParams));
    const results = await service.search(user.id, opts, { provider: 'manual' });
    return json({ results });
  } catch (err) {
    return apiError(err);
  }
}
