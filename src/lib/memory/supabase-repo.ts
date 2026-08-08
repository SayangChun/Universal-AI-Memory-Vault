// Production repository backed by Supabase Postgres RPC functions.
// All access goes through the service role client and the SECURITY DEFINER
// functions in supabase/migrations/0001_init.sql. Every function filters by
// the single owner's user_id.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DashboardStats,
  ExportItem,
  Memory,
  MemoryDetail,
} from '../types';
import { serializeEmbedding } from '../embeddings';
import type {
  MemoryRepo,
  RepoCreateInput,
  RepoListOptions,
  RepoSearchOptions,
  RepoUpdateInput,
} from './repository';

type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

export class SupabaseMemoryRepo implements MemoryRepo {
  constructor(private readonly client: SupabaseClient) {}

  private async rpc<T>(fn: string, args: Record<string, Json | undefined>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args as Record<string, unknown>);
    if (error) {
      throw new MemoryRepoError(describeRpcError(fn, error), error.code);
    }
    return data as T;
  }

  async create(userId: string, input: RepoCreateInput) {
    return this.rpc<MemoryDetail>('memory_create', {
      p_user_id: userId,
      p_content: input.content,
      p_type: input.type ?? 'fact',
      p_confidence: input.confidence ?? 0.8,
      p_importance: input.importance ?? 0.6,
      p_source: input.source ?? 'conversation',
      p_source_provider: input.provider,
      p_source_conversation_id: input.source_conversation_id ?? null,
      p_meta: (input.meta ?? {}) as unknown as Json,
      p_embedding: input.embedding ? serializeEmbedding(input.embedding) : null,
      p_supersedes: input.supersedes ?? null,
    });
  }

  async update(userId: string, id: string, input: RepoUpdateInput) {
    return this.rpc<MemoryDetail | null>('memory_update', {
      p_user_id: userId,
      p_memory_id: id,
      p_content: input.content ?? null,
      p_type: input.type ?? null,
      p_confidence: input.confidence ?? null,
      p_importance: input.importance ?? null,
      p_provider: input.provider,
      p_embedding: input.embedding ? serializeEmbedding(input.embedding) : null,
      p_meta: input.meta ? (input.meta as unknown as Json) : null,
    });
  }

  async delete(userId: string, id: string, provider: string) {
    return this.rpc<boolean>('memory_delete', {
      p_user_id: userId,
      p_memory_id: id,
      p_provider: provider,
    });
  }

  async get(userId: string, id: string, provider: string) {
    return this.rpc<MemoryDetail | null>('memory_get', {
      p_user_id: userId,
      p_memory_id: id,
      p_provider: provider,
    });
  }

  async list(userId: string, opts: RepoListOptions) {
    const rows = await this.rpc<Memory[]>('memory_list', {
      p_user_id: userId,
      p_type: opts.type ?? null,
      p_limit: opts.limit ?? 50,
      p_offset: opts.offset ?? 0,
      p_sort: opts.sort ?? 'updated',
    });
    return rows.map(normalizeMemory);
  }

  async search(userId: string, opts: RepoSearchOptions) {
    return this.rpc<Array<Memory & { score: number }>>('memory_search', {
      p_user_id: userId,
      p_query: opts.query ?? null,
      p_type: opts.type ?? null,
      p_limit: opts.limit ?? 8,
      p_embedding: opts.embedding ? serializeEmbedding(opts.embedding) : null,
      p_provider: opts.provider,
      p_min_importance: opts.minImportance ?? 0,
    });
  }

  async stats(userId: string) {
    return this.rpc<DashboardStats>('memory_stats', { p_user_id: userId });
  }

  async exportAll(userId: string) {
    return this.rpc<ExportItem[]>('memory_export', { p_user_id: userId });
  }

  async importBatch(userId: string, items: ExportItem[], provider: string) {
    return this.rpc<number>('memory_import_batch', {
      p_user_id: userId,
      p_items: items as unknown as Json,
      p_provider: provider,
    });
  }

  async deleteAll(userId: string, provider: string) {
    return this.rpc<number>('memory_delete_all', {
      p_user_id: userId,
      p_provider: provider,
    });
  }
}

function normalizeMemory(row: Memory): Memory {
  return { ...row, meta: (row.meta ?? {}) as Record<string, unknown> };
}

/** Map a Postgrest/supabase-js error into a message that names the real cause. */
function describeRpcError(fn: string, error: { message?: string; details?: string; hint?: string; code?: string }): string {
  const msg = error.message ?? 'Unknown error';
  // Network-level failures (DNS, connection refused, TLS…) surface as
  // "TypeError: fetch failed"; postgrest-js does not forward the inner cause.
  if (/fetch failed/i.test(msg)) {
    return [
      `${fn}: failed to reach Supabase (${msg}).`,
      '',
      `Configured NEXT_PUBLIC_SUPABASE_URL is: ${urlForError()}`,
      '',
      'The URL must be a live Supabase project, e.g. https://<project-ref>.supabase.co.',
      'A placeholder, an unassigned domain, or a paused project all cause this error.',
      'Update .env.local with real values and restart the dev server.',
    ].join('\n');
  }
  return `${fn}: ${msg}${error.details ? ` (${error.details})` : ''}`;
}

/** The Supabase URL currently configured, or a hint when it is missing. */
function urlForError(): string {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  if (!url) return '<unset>';
  if (/placeholder/i.test(url)) {
    return `${url}  ← placeholder, replace this with your real project URL`;
  }
  return url;
}

export class MemoryRepoError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'MemoryRepoError';
  }
}
