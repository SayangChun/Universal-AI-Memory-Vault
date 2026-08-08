// MemoryService — the single business-logic entry point used by both the
// REST API and the MCP tools. It owns embedding generation and delegates
// persistence to a MemoryRepo.
import type {
  ActorContext,
  MemoryCreateInput,
  MemoryDetail,
  MemoryUpdateInput,
  SearchOptions,
  Memory,
  DashboardStats,
  ExportItem,
} from '../types';
import { embedText } from '../embeddings';
import type { MemoryRepo, RepoListOptions } from './repository';

export type ListOptions = RepoListOptions;

export class MemoryService {
  constructor(private readonly repo: MemoryRepo) {}

  async create(userId: string, input: MemoryCreateInput, actor: ActorContext): Promise<MemoryDetail> {
    const embedding = await embedText(input.content);
    return this.repo.create(userId, {
      ...input,
      embedding,
      provider: actor.provider,
      source_conversation_id: input.source_conversation_id ?? actor.source_conversation_id ?? null,
    });
  }

  async update(
    userId: string,
    id: string,
    input: MemoryUpdateInput,
    actor: ActorContext,
  ): Promise<MemoryDetail | null> {
    const embedding = input.content ? await embedText(input.content) : null;
    return this.repo.update(userId, id, { ...input, embedding, provider: actor.provider });
  }

  async delete(userId: string, id: string, actor: ActorContext): Promise<boolean> {
    return this.repo.delete(userId, id, actor.provider);
  }

  async get(userId: string, id: string, actor: ActorContext): Promise<MemoryDetail | null> {
    return this.repo.get(userId, id, actor.provider);
  }

  async search(
    userId: string,
    opts: SearchOptions,
    actor: ActorContext,
  ): Promise<Array<Memory & { score: number }>> {
    const embedding = opts.query ? await embedText(opts.query) : null;
    return this.repo.search(userId, {
      query: opts.query,
      type: opts.type,
      limit: opts.limit,
      minImportance: opts.minImportance,
      embedding,
      provider: actor.provider,
    });
  }

  async list(userId: string, opts: ListOptions): Promise<Memory[]> {
    return this.repo.list(userId, opts);
  }

  async stats(userId: string): Promise<DashboardStats> {
    return this.repo.stats(userId);
  }

  async exportAll(userId: string): Promise<ExportItem[]> {
    return this.repo.exportAll(userId);
  }

  async importBatch(userId: string, items: ExportItem[], actor: ActorContext): Promise<number> {
    return this.repo.importBatch(userId, items, actor.provider);
  }

  async deleteAll(userId: string, actor: ActorContext): Promise<number> {
    return this.repo.deleteAll(userId, actor.provider);
  }
}
