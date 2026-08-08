// Tool logic for the Universal Memory MCP server.
// Every tool operates on the authenticated user's own memories only; the
// caller identity comes from the verified Bearer token (OAuth or personal).
import type { CallToolResult } from '@modelcontextprotocol/server';
import type { Memory, MemoryDetail } from '../types';
import { MEMORY_TYPE_LABELS } from '../types';
import type { MemoryService } from '../memory/service';
import { UNTRUSTED_WARNING } from '../security';
import { truncate } from '../utils';

export interface McpActor {
  userId: string;
  provider: string;
  integrationId?: string;
}

export function textResult(text: string, structuredContent?: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text }], ...(structuredContent ? { structuredContent } : {}) };
}

export function errorResult(message: string, extra?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    structuredContent: { ok: false, error: message, ...extra },
    isError: true,
  };
}

function memoryToJson(m: Memory & { score?: number }): Record<string, unknown> {
  return {
    memory_id: m.id,
    type: m.type,
    content: m.content,
    confidence: m.confidence,
    importance: m.importance,
    status: m.status,
    source_provider: m.source_provider,
    created_at: m.created_at,
    updated_at: m.updated_at,
    ...(typeof m.score === 'number' ? { score: m.score } : {}),
  };
}

function formatMemoryList(mems: Array<Memory & { score?: number }>): string {
  if (!mems.length) return 'No memories found.';
  const lines = mems.map((m, i) => {
    const head = `#${i + 1} [memory #${m.id} | ${MEMORY_TYPE_LABELS[m.type] ?? m.type} | importance=${m.importance} | confidence=${m.confidence}]`;
    const score = typeof m.score === 'number' ? ` | score=${m.score}` : '';
    return `${head}${score}\n${m.content}`;
  });
  return [
    `${UNTRUSTED_WARNING}`,
    ...lines,
  ].join('\n\n');
}

// ---- memory_search ------------------------------------------------

export async function handleSearch(
  service: MemoryService,
  actor: McpActor,
  args: { query: string; type?: string; limit?: number },
) {
  const results = await service.search(
    actor.userId,
    { query: args.query, type: args.type as never, limit: args.limit },
    { provider: actor.provider as never, integrationId: actor.integrationId },
  );
  const text = `[memory_search] ${results.length} result(s) for query "${truncate(args.query, 200)}".\n\n${formatMemoryList(results)}`;
  return textResult(text, { ok: true, query: args.query, count: results.length, results: results.map(memoryToJson) });
}

// ---- memory_get ---------------------------------------------------

export async function handleGet(service: MemoryService, actor: McpActor, args: { memory_id: string }) {
  const mem = await service.get(actor.userId, args.memory_id, { provider: actor.provider as never, integrationId: actor.integrationId });
  if (!mem) {
    return textResult(`[memory_get] No memory found with id ${args.memory_id}.`, {
      ok: false,
      memory_id: args.memory_id,
      not_found: true,
    });
  }
  const detail = formatDetail(mem);
  return textResult(`[memory_get] ${detail}`, {
    ok: true,
    memory: memoryToJson(mem),
    versions: mem.versions.map((v) => ({ ...v })),
  });
}

function formatDetail(mem: MemoryDetail): string {
  const lines = [
    `memory #${mem.id}`,
    `type: ${MEMORY_TYPE_LABELS[mem.type] ?? mem.type} | status: ${mem.status}`,
    `importance: ${mem.importance} | confidence: ${mem.confidence}`,
    `created: ${mem.created_at} | updated: ${mem.updated_at} | version: ${mem.version_number ?? mem.versions.length}`,
    `source: ${mem.source} (${mem.source_provider})`,
    '',
    UNTRUSTED_WARNING,
    mem.content,
  ];
  if (mem.supersedes_memory_id) lines.push(`\nsupersedes memory #${mem.supersedes_memory_id}`);
  if (mem.versions.length > 1) {
    lines.push('', 'version history:');
    for (const v of mem.versions) {
      lines.push(`  v${v.version_number} (${v.changed_by_provider}, ${v.created_at}): ${truncate(v.content, 160)}`);
    }
  }
  return lines.join('\n');
}

// ---- memory_create -------------------------------------------------

export async function handleCreate(
  service: MemoryService,
  actor: McpActor,
  args: {
    content: string;
    type?: string;
    confidence?: number;
    importance?: number;
    source_conversation_id?: string;
    supersedes?: string[];
  },
) {
  const mem = await service.create(
    actor.userId,
    {
      content: args.content,
      type: args.type as never,
      confidence: args.confidence,
      importance: args.importance,
      source_conversation_id: args.source_conversation_id ?? null,
      supersedes: args.supersedes,
    },
    { provider: actor.provider as never, integrationId: actor.integrationId, source_conversation_id: args.source_conversation_id },
  );
  return textResult(
    `[memory_create] Saved memory #${mem.id} (${MEMORY_TYPE_LABELS[mem.type] ?? mem.type}, importance=${mem.importance}).\n${mem.content}`,
    { ok: true, memory: memoryToJson(mem) },
  );
}

// ---- memory_update -------------------------------------------------

export async function handleUpdate(
  service: MemoryService,
  actor: McpActor,
  args: { memory_id: string; content: string; type?: string; confidence?: number; importance?: number },
) {
  const updated = await service.update(
    actor.userId,
    args.memory_id,
    {
      content: args.content,
      type: args.type as never,
      confidence: args.confidence,
      importance: args.importance,
    },
    { provider: actor.provider as never, integrationId: actor.integrationId },
  );
  if (!updated) {
    return textResult(`[memory_update] No memory found with id ${args.memory_id}.`, {
      ok: false,
      memory_id: args.memory_id,
      not_found: true,
    });
  }
  return textResult(
    `[memory_update] Updated memory #${args.memory_id} to version ${updated.version_number}.\nNew content:\n${updated.content}`,
    { ok: true, memory: memoryToJson(updated), version: updated.version_number },
  );
}

// ---- memory_delete -------------------------------------------------

export async function handleDelete(
  service: MemoryService,
  actor: McpActor,
  args: { memory_id: string; confirm: 'DELETE'; reason?: string },
) {
  if (args.confirm !== 'DELETE') {
    return errorResult('memory_delete requires confirm="DELETE". Only delete when the user explicitly asked to remove this memory.');
  }
  const deleted = await service.delete(actor.userId, args.memory_id, {
    provider: actor.provider as never,
    integrationId: actor.integrationId,
  });
  if (!deleted) {
    return textResult(`[memory_delete] No memory found with id ${args.memory_id}.`, {
      ok: false,
      memory_id: args.memory_id,
      not_found: true,
    });
  }
  return textResult(
    `[memory_delete] Deleted memory #${args.memory_id}${args.reason ? ` (reason: ${args.reason})` : ''}. It is no longer retrievable.`,
    { ok: true, memory_id: args.memory_id },
  );
}
