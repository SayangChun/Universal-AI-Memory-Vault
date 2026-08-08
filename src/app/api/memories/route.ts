import { getAdminClient } from '@/lib/supabase/admin';
import { MemoryService } from '@/lib/memory/service';
import { SupabaseMemoryRepo } from '@/lib/memory/supabase-repo';
import { memoryCreateSchema, memoryListSchema } from '@/lib/validation';
import { json, apiError, requireUser, applyRateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(new SupabaseMemoryRepo(getAdminClient()));

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'list');
    const url = new URL(request.url);
    const opts = memoryListSchema.parse(Object.fromEntries(url.searchParams));
    const memories = await service.list(user.id, opts);
    return json({ memories, total: memories.length });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'create');
    const body = await request.json().catch(() => null);
    const input = memoryCreateSchema.parse(body ?? {});
    const memory = await service.create(user.id, input, { provider: 'manual' });
    return json({ memory }, 201);
  } catch (err) {
    return apiError(err);
  }
}
