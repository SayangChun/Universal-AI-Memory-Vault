import { MemoryService } from '@/lib/memory/service';
import { getMemoryRepo } from '@/lib/memory/repo-factory';
import { json, apiError, requireUser, applyRateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(getMemoryRepo());

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
