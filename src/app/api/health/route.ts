import { getServerEnv } from '@/lib/env';
import { json } from '@/lib/api';

export function GET(): Response {
  const env = getServerEnv();
  return json({
    ok: true,
    service: 'universal-memory-vault',
    time: new Date().toISOString(),
    ready: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
    embedding_provider: env.embeddingProvider,
  });
}

export const dynamic = 'force-dynamic';
