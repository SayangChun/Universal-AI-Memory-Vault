import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMemoryRepo } from '@/lib/memory/memory-repo-inmemory';
import { MemoryService } from '@/lib/memory/service';

function setup() {
  const repo = new InMemoryMemoryRepo();
  const service = new MemoryService(repo);
  return { repo, service };
}

describe('MemoryService with InMemoryMemoryRepo', () => {
  let service: MemoryService;

  beforeEach(() => {
    ({ service } = setup());
  });

  it('creates a memory with defaults', async () => {
    const m = await service.create('user-1', { content: 'Likes dark mode' }, { provider: 'claude' });
    expect(m.id).toBeTruthy();
    expect(m.type).toBe('fact');
    expect(m.content).toBe('Likes dark mode');
    expect(m.status).toBe('active');
    expect(m.version_number).toBe(1);
    expect(m.source_provider).toBe('claude');
    expect(m.versions).toHaveLength(1);
  });

  it('isolates users: cannot read another user’s memory', async () => {
    const a = await service.create('user-1', { content: 'secret of user 1' }, { provider: 'claude' });
    const b = await service.create('user-2', { content: 'secret of user 2' }, { provider: 'chatgpt' });

    const from2 = await service.get('user-2', a.id, { provider: 'chatgpt' });
    expect(from2).toBeNull();

    const list1 = await service.list('user-1', {});
    expect(list1).toHaveLength(1);
    expect(list1[0].id).toBe(a.id);
    const list2 = await service.list('user-2', {});
    expect(list2).toHaveLength(1);
    expect(list2[0].id).toBe(b.id);
  });

  it('isolates users: cannot update or delete another user’s memory', async () => {
    const a = await service.create('user-1', { content: 'keep' }, { provider: 'claude' });
    const updated = await service.update('user-2', a.id, { content: 'hacked' }, { provider: 'chatgpt' });
    expect(updated).toBeNull();
    const deleted = await service.delete('user-2', a.id, { provider: 'chatgpt' });
    expect(deleted).toBe(false);
    const stillThere = await service.get('user-1', a.id, { provider: 'claude' });
    expect(stillThere).not.toBeNull();
  });

  it('keeps version history on update', async () => {
    const m = await service.create('user-1', { content: 'Goal: run a marathon' }, { provider: 'claude' });
    const v2 = await service.update('user-1', m.id, { content: 'Goal: run a 5k' }, { provider: 'claude' });
    expect(v2).not.toBeNull();
    expect(v2!.version_number).toBe(2);
    expect(v2!.versions).toHaveLength(2);

    const detail = await service.get('user-1', m.id, { provider: 'claude' });
    expect(detail!.versions.map((v) => v.content)).toContain('Goal: run a marathon');
    expect(detail!.versions.map((v) => v.content)).toContain('Goal: run a 5k');
  });

  it('does not bump version when content is unchanged', async () => {
    const m = await service.create('user-1', { content: 'Prefers coffee', importance: 0.5 }, { provider: 'claude' });
    const updated = await service.update('user-1', m.id, { importance: 0.6 }, { provider: 'claude' });
    expect(updated!.version_number).toBe(1);
    expect(updated!.importance).toBe(0.6);
  });

  it('supersedes an older memory on conflict resolution', async () => {
    const old = await service.create('user-1', { content: 'Works at Acme' }, { provider: 'claude' });
    const fresh = await service.create(
      'user-1',
      { content: 'Now works at Globex', supersedes: [old.id] },
      { provider: 'chatgpt' },
    );
    expect(fresh.supersedes_memory_id).toBe(old.id);

    const oldDetail = await service.get('user-1', old.id, { provider: 'claude' });
    expect(oldDetail!.status).toBe('superseded');

    // superseded memories are hidden from search
    const results = await service.search('user-1', { query: 'Acme' }, { provider: 'claude' });
    expect(results.length).toBe(0);
  });

  it('cannot supersede another user’s memory', async () => {
    const other = await service.create('user-2', { content: 'their fact' }, { provider: 'chatgpt' });
    const mine = await service.create('user-1', { content: 'my fact', supersedes: [other.id] }, { provider: 'claude' });
    expect(mine.supersedes_memory_id).toBeNull();
    const still = await service.get('user-2', other.id, { provider: 'chatgpt' });
    expect(still!.status).toBe('active');
  });

  it('hard-deletes a memory; get returns null afterwards', async () => {
    const m = await service.create('user-1', { content: 'delete me' }, { provider: 'claude' });
    const ok = await service.delete('user-1', m.id, { provider: 'claude' });
    expect(ok).toBe(true);
    expect(await service.get('user-1', m.id, { provider: 'claude' })).toBeNull();
  });

  it('search filters by type and min importance', async () => {
    await service.create('user-1', { content: 'Loves hiking in the mountains', type: 'preference', importance: 0.9 }, { provider: 'claude' });
    await service.create('user-1', { content: 'Owns a bicycle', type: 'fact', importance: 0.3 }, { provider: 'claude' });

    const prefs = await service.search('user-1', { query: 'hiking', type: 'preference' }, { provider: 'claude' });
    expect(prefs).toHaveLength(1);

    const all = await service.search('user-1', { query: '' }, { provider: 'claude' });
    expect(all).toHaveLength(2);

    const important = await service.search('user-1', { query: '', minImportance: 0.5 }, { provider: 'claude' });
    expect(important).toHaveLength(1);
    expect(important[0].content).toContain('hiking');
  });

  it('search records an audit entry', async () => {
    await service.create('user-1', { content: 'Has a cat named Mochi' }, { provider: 'claude' });
    await service.search('user-1', { query: 'cat' }, { provider: 'chatgpt' });
    const stats = await service.stats('user-1');
    expect(stats.recent_updates.some((a) => a.action === 'search' && a.source_provider === 'chatgpt')).toBe(true);
  });

  it('stats count by type', async () => {
    await service.create('user-1', { content: 'f1', type: 'fact' }, { provider: 'claude' });
    await service.create('user-1', { content: 'f2', type: 'fact' }, { provider: 'claude' });
    await service.create('user-1', { content: 'p1', type: 'preference' }, { provider: 'claude' });
    const stats = await service.stats('user-1');
    expect(stats.total).toBe(3);
    expect(stats.by_type.fact).toBe(2);
    expect(stats.by_type.preference).toBe(1);
  });

  it('deleteAll removes only the requesting user’s data', async () => {
    await service.create('user-1', { content: 'a' }, { provider: 'claude' });
    await service.create('user-1', { content: 'b' }, { provider: 'claude' });
    await service.create('user-2', { content: 'c' }, { provider: 'chatgpt' });

    const deleted = await service.deleteAll('user-1', { provider: 'manual' });
    expect(deleted).toBe(2);
    expect(await service.list('user-1', {})).toHaveLength(0);
    expect(await service.list('user-2', {})).toHaveLength(1);
  });
});
