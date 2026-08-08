import { MemoryService } from '@/lib/memory/service';
import { getMemoryRepo } from '@/lib/memory/repo-factory';
import { apiError, requireUser, applyRateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(getMemoryRepo());

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'export');
    const items = await service.exportAll(user.id);
    const payload = {
      format: 'universal-memory',
      version: 1,
      exported_at: new Date().toISOString(),
      count: items.length,
      items,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="universal-memory.json"',
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
