import { getAdminClient } from '@/lib/supabase/admin';
import { MemoryService } from '@/lib/memory/service';
import { SupabaseMemoryRepo } from '@/lib/memory/supabase-repo';
import { memoryUpdateSchema, memoryDeleteSchema } from '@/lib/validation';
import { json, apiError, requireUser, applyRateLimit, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const service = new MemoryService(new SupabaseMemoryRepo(getAdminClient()));

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const memory = await service.get(user.id, id, { provider: 'manual' });
    if (!memory) throw new ApiError(404, 'Memory not found', 'not_found');
    return json({ memory });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'update');
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const input = memoryUpdateSchema.parse(body ?? {});
    const memory = await service.update(user.id, id, input, { provider: 'manual' });
    if (!memory) throw new ApiError(404, 'Memory not found', 'not_found');
    return json({ memory });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const user = await requireUser();
    applyRateLimit(user.id, 'delete');
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = memoryDeleteSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ApiError(400, 'Deletion requires { "confirm": "DELETE" }', 'confirm_required');
    }
    const deleted = await service.delete(user.id, id, { provider: 'manual' });
    if (!deleted) throw new ApiError(404, 'Memory not found', 'not_found');
    return json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
