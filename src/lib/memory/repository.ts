// Repository contract for Memory persistence.
// Two implementations exist:
//   - SupabaseMemoryRepo   (production, via Postgres RPC functions)
//   - InMemoryMemoryRepo   (unit tests, no database required)
// Both must preserve the same semantics (ownership, versioning, hard delete).
import type {
  DashboardStats,
  ExportItem,
  Memory,
  MemoryCreateInput,
  MemoryDetail,
  MemoryType,
  MemoryUpdateInput,
} from '../types';

export interface RepoCreateInput extends MemoryCreateInput {
  embedding?: number[] | null;
  provider: string;
}

export interface RepoUpdateInput extends MemoryUpdateInput {
  embedding?: number[] | null;
  provider: string;
}

export interface RepoSearchOptions {
  query?: string;
  type?: MemoryType;
  limit?: number;
  minImportance?: number;
  embedding?: number[] | null;
  provider: string;
}

export interface RepoListOptions {
  type?: MemoryType;
  limit?: number;
  offset?: number;
  sort?: 'updated' | 'created' | 'accessed';
}

export interface MemoryRepo {
  create(userId: string, input: RepoCreateInput): Promise<MemoryDetail>;
  update(userId: string, id: string, input: RepoUpdateInput): Promise<MemoryDetail | null>;
  delete(userId: string, id: string, provider: string): Promise<boolean>;
  get(userId: string, id: string, provider: string): Promise<MemoryDetail | null>;
  list(userId: string, opts: RepoListOptions): Promise<Memory[]>;
  search(userId: string, opts: RepoSearchOptions): Promise<Array<Memory & { score: number }>>;
  stats(userId: string): Promise<DashboardStats>;
  exportAll(userId: string): Promise<ExportItem[]>;
  importBatch(userId: string, items: ExportItem[], provider: string): Promise<number>;
  deleteAll(userId: string, provider: string): Promise<number>;
}
