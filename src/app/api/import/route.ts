import { MemoryService } from '@/lib/memory/service';
import { getMemoryRepo } from '@/lib/memory/repo-factory';
import { importSchema } from '@/lib/validation';
import { json, apiError, requireUser, applyRateLimit, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(getMemoryRepo());

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'import');
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ApiError(400, 'Expected JSON body', 'invalid_body');
    }
    const rawItems = Array.isArray(body) ? body : body.items;
    const parsed = importSchema.safeParse({ items: rawItems });
    if (!parsed.success) {
      throw new ApiError(400, `Invalid import data: ${parsed.error.issues[0]?.message ?? 'validation failed'}`, 'invalid_import');
    }
    const count = await service.importBatch(user.id, parsed.data.items, { provider: 'api' });
    return json({ ok: true, imported: count });
  } catch (err) {
    return apiError(err);
  }
}
