// In-memory implementation of MemoryRepo used by unit tests.
// Mirrors the SQL semantics in supabase/migrations/0001_init.sql:
// ownership filtering, version snapshotting, hard delete, supersede,
// lexical search scoring and audit logging.
import type {
  AuditEntry,
  DashboardStats,
  ExportItem,
  Memory,
  MemoryDetail,
  MemoryType,
  MemoryVersion,
  Provider,
} from '../types';
import { MEMORY_TYPES } from '../types';
import type {
  MemoryRepo,
  RepoCreateInput,
  RepoListOptions,
  RepoSearchOptions,
  RepoUpdateInput,
} from './repository';

interface Row {
  memory: Memory;
  versions: MemoryVersion[];
  audit: AuditEntry[];
}

function newId(): string {
  return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14);
}

export class InMemoryMemoryRepo implements MemoryRepo {
  private rows = new Map<string, Row>(); // key: memory id
  private auditAll: Array<{ userId: string; entry: AuditEntry }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.rows.clear();
    this.auditAll = [];
  }

  private ensureType(t: string | undefined): MemoryType {
    return MEMORY_TYPES.includes(t as MemoryType) ? (t as MemoryType) : 'fact';
  }

  private ensureProvider(p: string | undefined): Provider {
    const providers: Provider[] = ['chatgpt', 'claude', 'gemini', 'other', 'manual', 'api'];
    return providers.includes(p as Provider) ? (p as Provider) : 'other';
  }

  private audit(userId: string, memoryId: string | null, action: AuditEntry['action'], provider: string, detail: Record<string, unknown>) {
    const entry: AuditEntry = {
      action,
      source_provider: this.ensureProvider(provider),
      detail,
      created_at: new Date().toISOString(),
    };
    const row = memoryId ? this.rows.get(memoryId) : null;
    if (row) row.audit.unshift(entry);
    this.auditAll.push({ userId, entry });
  }

  private toDetail(row: Row): MemoryDetail {
    const { memory, versions, audit } = row;
    const v = versions.length ? Math.max(...versions.map((x) => x.version_number)) : 1;
    return {
      ...memory,
      meta: { ...(memory.meta ?? {}) },
      version_number: v,
      versions: [...versions].sort((a, b) => b.version_number - a.version_number),
      audit: [...audit],
    };
  }

  async create(userId: string, input: RepoCreateInput) {
    const now = new Date().toISOString();
    const id = newId();
    const memory: Memory = {
      id,
      user_id: userId,
      type: this.ensureType(input.type),
      content: input.content,
      confidence: input.confidence ?? 0.8,
      importance: input.importance ?? 0.6,
      status: 'active',
      source: input.source ?? 'conversation',
      source_provider: this.ensureProvider(input.provider),
      source_conversation_id: input.source_conversation_id ?? null,
      updated_by_provider: this.ensureProvider(input.provider),
      meta: { ...(input.meta ?? {}) },
      supersedes_memory_id: null,
      created_at: now,
      updated_at: now,
      last_accessed_at: null,
      version_number: 1,
    };
    const versions: MemoryVersion[] = [
      {
        version_number: 1,
        content: input.content,
        type: memory.type,
        confidence: memory.confidence,
        importance: memory.importance,
        changed_by_provider: memory.source_provider,
        created_at: now,
      },
    ];
    this.rows.set(id, { memory, versions, audit: [] });
    if (input.supersedes?.length) {
      const first = input.supersedes[0];
      const target = this.rows.get(first);
      if (target && target.memory.user_id === userId && target.memory.id !== id) {
        target.memory.status = 'superseded';
        target.memory.updated_at = new Date().toISOString();
        memory.supersedes_memory_id = first;
      }
    }
    this.audit(userId, id, 'create', input.provider, { type: memory.type });
    return this.toDetail(this.rows.get(id)!);
  }

  async update(userId: string, id: string, input: RepoUpdateInput) {
    const row = this.rows.get(id);
    if (!row || row.memory.user_id !== userId) return null;

    const now = new Date().toISOString();
    const cur = row.memory;
    const nextContent = input.content ?? cur.content;
    const nextType = input.type ? this.ensureType(input.type) : cur.type;
    const nextConf = input.confidence ?? cur.confidence;
    const nextImp = input.importance ?? cur.importance;

    if (nextContent !== cur.content) {
      const nextNum = row.versions.length ? Math.max(...row.versions.map((v) => v.version_number)) + 1 : 1;
      row.versions.push({
        version_number: nextNum,
        content: nextContent,
        type: nextType,
        confidence: nextConf,
        importance: nextImp,
        changed_by_provider: this.ensureProvider(input.provider),
        created_at: now,
      });
    }

    cur.content = nextContent;
    cur.type = nextType;
    cur.confidence = nextConf;
    cur.importance = nextImp;
    cur.updated_by_provider = this.ensureProvider(input.provider);
    cur.updated_at = now;
    if (input.meta) cur.meta = { ...(cur.meta ?? {}), ...input.meta };

    this.audit(userId, id, 'update', input.provider, {
      version: row.versions.length ? Math.max(...row.versions.map((v) => v.version_number)) : 1,
    });
    return this.toDetail(row);
  }

  async delete(userId: string, id: string, provider: string) {
    const row = this.rows.get(id);
    if (!row || row.memory.user_id !== userId) return false;
    this.audit(userId, id, 'delete', provider, { content_preview: row.memory.content.slice(0, 200) });
    this.rows.delete(id);
    return true;
  }

  async get(userId: string, id: string, provider: string) {
    const row = this.rows.get(id);
    if (!row || row.memory.user_id !== userId) return null;
    row.memory.last_accessed_at = new Date().toISOString();
    this.audit(userId, id, 'get', provider, {});
    return this.toDetail(row);
  }

  async list(userId: string, opts: RepoListOptions) {
    let items = [...this.rows.values()]
      .map((r) => r.memory)
      .filter((m) => m.user_id === userId)
      .filter((m) => !opts.type || m.type === opts.type);
    const sort = opts.sort ?? 'updated';
    items = items.sort((a, b) => {
      const ka = sort === 'created' ? a.created_at : sort === 'accessed' ? (a.last_accessed_at ?? '') : a.updated_at;
      const kb = sort === 'created' ? b.created_at : sort === 'accessed' ? (b.last_accessed_at ?? '') : b.updated_at;
      return kb.localeCompare(ka);
    });
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 50;
    return items.slice(offset, offset + limit);
  }

  async search(userId: string, opts: RepoSearchOptions) {
    const q = (opts.query ?? '').trim().toLowerCase();
    const items = [...this.rows.values()]
      .map((r) => r.memory)
      .filter((m) => m.user_id === userId && m.status === 'active')
      .filter((m) => !opts.type || m.type === opts.type)
      .filter((m) => (opts.minImportance ?? 0) <= m.importance)
      .filter((m) => !q || m.content.toLowerCase().includes(q));

    const scored = items.map((m) => {
      let score = m.importance * 0.5;
      if (q) {
        if (m.content.toLowerCase().includes(q)) score += 1;
        const words = q.split(/\s+/);
        const hits = words.filter((w) => m.content.toLowerCase().includes(w)).length;
        score += words.length ? (hits / words.length) * 1.5 : 0;
      }
      return { ...m, score: Number(score.toFixed(4)) };
    });

    scored.sort((a, b) => b.score - a.score || b.importance - a.importance || b.updated_at.localeCompare(a.updated_at));
    const limit = Math.min(opts.limit ?? 8, 20);
    const top = scored.slice(0, limit);

    this.audit(userId, null, 'search', opts.provider, { query: opts.query ?? null, result_count: top.length });
    return top;
  }

  async stats(userId: string): Promise<DashboardStats> {
    const mems = [...this.rows.values()].map((r) => r.memory).filter((m) => m.user_id === userId);
    const by_type: Record<string, number> = {};
    for (const m of mems) by_type[m.type] = (by_type[m.type] ?? 0) + 1;
    const recent = [...mems]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        importance: m.importance,
        updated_at: m.updated_at,
      }));
    const recentUpdates = this.auditAll
      .filter((a) => a.userId === userId)
      .map((a) => a.entry)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12);
    return { total: mems.length, by_type, recent_memories: recent, recent_updates: recentUpdates };
  }

  async exportAll(userId: string): Promise<ExportItem[]> {
    const items: ExportItem[] = [];
    for (const row of this.rows.values()) {
      if (row.memory.user_id !== userId) continue;
      const { memory } = row;
      items.push({
        id: memory.id,
        type: memory.type,
        content: memory.content,
        confidence: memory.confidence,
        importance: memory.importance,
        status: memory.status,
        source: memory.source,
        source_provider: memory.source_provider,
        source_conversation_id: memory.source_conversation_id,
        meta: memory.meta,
        supersedes_memory_id: memory.supersedes_memory_id,
        created_at: memory.created_at,
        updated_at: memory.updated_at,
        versions: [...row.versions].sort((a, b) => a.version_number - b.version_number),
      });
    }
    this.audit(userId, null, 'export', 'manual', { count: items.length });
    return items;
  }

  async importBatch(userId: string, items: ExportItem[], provider: string) {
    let count = 0;
    for (const item of items) {
      if (!item.content) continue;
      await this.create(userId, {
        content: item.content,
        type: item.type,
        confidence: item.confidence ?? 0.8,
        importance: item.importance ?? 0.6,
        source: item.source ?? 'import',
        source_conversation_id: item.source_conversation_id ?? null,
        meta: item.meta,
        provider,
      });
      count++;
    }
    return count;
  }

  async deleteAll(userId: string, _provider: string) {
    let count = 0;
    for (const [id, row] of [...this.rows]) {
      if (row.memory.user_id === userId) {
        this.rows.delete(id);
        count++;
      }
    }
    this.auditAll = this.auditAll.filter((a) => a.userId !== userId);
    return count;
  }

  // Test helpers ---------------------------------------------------
  dump(userId?: string): Array<{ memory: Memory; versions: MemoryVersion[]; audit: AuditEntry[] }> {
    const all = [...this.rows.values()].map((r) => ({ memory: { ...r.memory, meta: { ...r.memory.meta } }, versions: [...r.versions], audit: [...r.audit] }));
    return userId ? all.filter((r) => r.memory.user_id === userId) : all;
  }
}
