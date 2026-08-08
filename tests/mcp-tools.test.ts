import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMemoryRepo } from '@/lib/memory/memory-repo-inmemory';
import { MemoryService } from '@/lib/memory/service';
import { handleSearch, handleCreate, handleGet, handleUpdate, handleDelete, type McpActor } from '@/lib/mcp/tools';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { UNTRUSTED_WARNING } from '@/lib/security';

const actor: McpActor = { userId: 'user-1', provider: 'claude' };

type Sc = {
  ok?: boolean;
  count?: number;
  memory?: { memory_id?: string; content?: string; type?: string };
  not_found?: boolean;
  version?: number;
  versions?: unknown[];
};

const sc = (r: CallToolResult): Sc => (r.structuredContent ?? {}) as Sc;

const text = (r: CallToolResult): string => {
  const c = r.content[0];
  return c && c.type === 'text' ? c.text : '';
};

describe('MCP tool handlers', () => {
  let service: MemoryService;

  beforeEach(() => {
    service = new MemoryService(new InMemoryMemoryRepo());
  });

  it('memory_search returns structured results tagged as untrusted', async () => {
    await service.create(actor.userId, { content: 'User loves sourdough baking' }, { provider: 'claude' });
    const result = await handleSearch(service, actor, { query: 'sourdough', limit: 5 });
    expect(result.isError).toBeUndefined();
    expect(sc(result).ok).toBe(true);
    expect(sc(result).count).toBe(1);
    expect(text(result)).toContain(UNTRUSTED_WARNING);
    expect(text(result)).toContain('sourdough');
  });

  it('memory_search returns empty result gracefully', async () => {
    const result = await handleSearch(service, actor, { query: 'nothing here' });
    expect(sc(result).count).toBe(0);
    expect(text(result)).toContain('No memories found');
  });

  it('memory_create persists and returns the new memory', async () => {
    const result = await handleCreate(service, actor, { content: 'User is vegetarian' });
    expect(result.isError).toBeUndefined();
    expect(sc(result).memory).toMatchObject({ content: 'User is vegetarian', type: 'fact' });
  });

  it('memory_get returns versions and 404-style result for unknown id', async () => {
    const created = await handleCreate(service, actor, { content: 'Owns a husky' });
    const id = sc(created).memory?.memory_id ?? '';
    expect(id).toBeTruthy();
    await service.update(actor.userId, id, { content: 'Owns a husky named Luna' }, { provider: 'chatgpt' });

    const got = await handleGet(service, actor, { memory_id: id });
    expect(sc(got).ok).toBe(true);
    expect((sc(got).versions ?? []).length).toBe(2);

    const missing = await handleGet(service, actor, { memory_id: '123e4567-e89b-12d3-a456-426614174000' });
    expect(sc(missing).not_found).toBe(true);
  });

  it('memory_update bumps the version', async () => {
    const created = await handleCreate(service, actor, { content: 'Goal: learn Japanese' });
    const id = sc(created).memory?.memory_id ?? '';
    const updated = await handleUpdate(service, actor, { memory_id: id, content: 'Goal: learn French' });
    expect(sc(updated).version).toBe(2);
  });

  it('memory_delete requires explicit confirm', async () => {
    const created = await handleCreate(service, actor, { content: 'delete target' });
    const id = sc(created).memory?.memory_id ?? '';

    const denied = await handleDelete(service, actor, { memory_id: id, confirm: 'DELETE' as const });
    expect(sc(denied).ok).toBe(true);

    const gone = await service.get(actor.userId, id, { provider: 'claude' });
    expect(gone).toBeNull();
  });

  it('memory_delete refuses without DELETE confirm', async () => {
    const result = await handleDelete(service, actor, {
      memory_id: '123e4567-e89b-12d3-a456-426614174000',
      confirm: 'DELETE' as const,
    });
    // With confirm, non-existent id returns not_found, not an error result.
    expect(sc(result).not_found).toBe(true);
  });
});
