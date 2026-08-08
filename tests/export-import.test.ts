import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMemoryRepo } from '@/lib/memory/memory-repo-inmemory';
import { MemoryService } from '@/lib/memory/service';

describe('Export / Import roundtrip', () => {
  let service: MemoryService;

  beforeEach(() => {
    service = new MemoryService(new InMemoryMemoryRepo());
  });

  it('exports all memories with versions and re-imports into a fresh user', async () => {
    const m1 = await service.create(
      'user-1',
      { content: 'Prefers working mornings', type: 'preference', importance: 0.8 },
      { provider: 'claude' },
    );
    await service.update('user-1', m1.id, { content: 'Prefers working mornings, not evenings' }, { provider: 'chatgpt' });
    await service.create('user-1', { content: 'Allergic to peanuts', type: 'fact' }, { provider: 'claude' });

    const items = await service.exportAll('user-1');
    expect(items).toHaveLength(2);
    const withVersions = items.find((i) => i.id === m1.id)!;
    expect(withVersions.versions).toHaveLength(2);

    // Import into a different user (data portability).
    const imported = await service.importBatch('user-2', items, { provider: 'api' });
    expect(imported).toBe(2);

    const list2 = await service.list('user-2', {});
    expect(list2).toHaveLength(2);
    const contents = list2.map((m) => m.content);
    expect(contents).toContain('Prefers working mornings, not evenings');
    expect(contents).toContain('Allergic to peanuts');

    // Original user untouched.
    expect(await service.list('user-1', {})).toHaveLength(2);
  });

  it('export for a user with no memories is empty', async () => {
    const items = await service.exportAll('user-1');
    expect(items).toHaveLength(0);
  });

  it('import records an import audit entry', async () => {
    await service.create('user-1', { content: 'x' }, { provider: 'claude' });
    const items = await service.exportAll('user-1');
    await service.importBatch('user-3', items, { provider: 'api' });
    const stats = await service.stats('user-3');
    expect(stats.recent_updates.some((a) => a.action === 'create')).toBe(true);
  });
});
