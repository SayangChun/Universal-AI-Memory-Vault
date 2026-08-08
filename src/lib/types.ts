// Domain types for Universal Memory. These are provider-agnostic:
// nothing here is bound to OpenAI, Anthropic or Google.

export const MEMORY_TYPES = [
  'fact',
  'preference',
  'habit',
  'goal',
  'life_event',
  'relationship',
  'worldview',
  'project',
  'temporary',
  'other',
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  fact: '事实',
  preference: '偏好',
  habit: '习惯',
  goal: '目标',
  life_event: '人生事件',
  relationship: '人际关系',
  worldview: '世界观',
  project: '项目',
  temporary: '临时',
  other: '其他',
};

export const MEMORY_TYPE_EN: Record<MemoryType, string> = {
  fact: 'Fact',
  preference: 'Preference',
  habit: 'Habit',
  goal: 'Goal',
  life_event: 'Life Event',
  relationship: 'Relationship',
  worldview: 'Worldview',
  project: 'Project',
  temporary: 'Temporary',
  other: 'Other',
};

export type MemoryStatus = 'active' | 'superseded';

export const PROVIDERS = ['chatgpt', 'claude', 'gemini', 'other', 'manual', 'api'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  other: 'Other AI',
  manual: 'Manual / Web',
  api: 'API',
};

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'get'
  | 'search'
  | 'list'
  | 'export'
  | 'import';

export interface Memory {
  id: string;
  user_id: string;
  type: MemoryType;
  content: string;
  confidence: number;
  importance: number;
  status: MemoryStatus;
  source: string;
  source_provider: Provider;
  source_conversation_id: string | null;
  updated_by_provider: Provider | null;
  meta: Record<string, unknown>;
  supersedes_memory_id: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  version_number?: number;
}

export interface MemoryVersion {
  version_number: number;
  content: string;
  type: MemoryType;
  confidence: number;
  importance: number;
  changed_by_provider: Provider;
  created_at: string;
}

export interface AuditEntry {
  action: AuditAction;
  source_provider: Provider;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface MemoryDetail extends Memory {
  versions: MemoryVersion[];
  audit: AuditEntry[];
}

export interface MemoryCreateInput {
  content: string;
  type?: MemoryType;
  confidence?: number;
  importance?: number;
  source?: string;
  source_conversation_id?: string | null;
  meta?: Record<string, unknown>;
  /** ids of memories this new memory supersedes (conflict resolution). */
  supersedes?: string[];
}

export interface MemoryUpdateInput {
  content?: string;
  type?: MemoryType;
  confidence?: number;
  importance?: number;
  meta?: Record<string, unknown>;
}

export interface SearchOptions {
  query?: string;
  type?: MemoryType;
  limit?: number;
  minImportance?: number;
}

export interface ActorContext {
  /** Which AI platform (or manual/web) performed this action. */
  provider: Provider;
  integrationId?: string;
  source_conversation_id?: string;
}

export interface DashboardStats {
  total: number;
  by_type: Record<string, number>;
  recent_memories: Array<Pick<Memory, 'id' | 'type' | 'content' | 'importance' | 'updated_at'>>;
  recent_updates: AuditEntry[];
}

export interface ExportItem {
  id?: string;
  type: MemoryType;
  content: string;
  confidence?: number;
  importance?: number;
  status?: MemoryStatus;
  source?: string;
  source_provider?: Provider;
  source_conversation_id?: string | null;
  meta?: Record<string, unknown>;
  supersedes_memory_id?: string | null;
  created_at?: string;
  updated_at?: string;
  versions?: MemoryVersion[];
}
