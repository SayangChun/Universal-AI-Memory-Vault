'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MEMORY_TYPES, MEMORY_TYPE_LABELS, MEMORY_TYPE_EN, type MemoryType } from '@/lib/types';
import { formatDate, truncate } from '@/lib/utils';

interface MemoryRow {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  status: string;
  source_provider: string;
  updated_at: string;
}

function typeLabel(t: MemoryType): string {
  return MEMORY_TYPE_LABELS[t] ?? MEMORY_TYPE_EN[t] ?? t;
}

export default function MemoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = (searchParams.get('type') ?? '') as MemoryType | '';
  const qParam = searchParams.get('q') ?? '';

  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [query, setQuery] = useState(qParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (typeParam) params.set('type', typeParam);
      if (qParam) {
        params.set('query', qParam);
        const res = await fetch(`/api/memories/search?${params}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setMemories(data.results ?? []);
      } else {
        const res = await fetch(`/api/memories?${params}`);
        if (!res.ok) throw new Error('Failed to load memories');
        const data = await res.json();
        setMemories(data.memories ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [typeParam, qParam]);

  useEffect(() => {
    // Data fetching on mount / when filters change.
    void fetchMemories();
  }, [fetchMemories]);

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/memories?${p.toString()}`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Memories</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">Everything your AI knows about you.</p>
        </div>
        <Link
          href="/memories/new"
          className="rounded-lg bg-[#2563eb] px-4 py-2 text-center text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          + New memory
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setParam('q', query.trim());
          }}
          placeholder="Search memories… (Enter to search)"
          className="w-full rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-2 text-sm outline-none focus:border-[#2563eb] sm:w-80"
        />
        <select
          value={typeParam}
          onChange={(e) => setParam('type', e.target.value)}
          className="rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e9f0] outline-none focus:border-[#2563eb]"
        >
          <option value="">All types</option>
          {MEMORY_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        {(typeParam || qParam) && (
          <button
            onClick={() => router.push('/memories')}
            className="rounded-lg border border-[#374151] px-3 py-2 text-sm text-[#9ca3af] hover:bg-[#1f2937]"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="mt-8 text-center text-sm text-[#6b7280]">Loading…</p>
      ) : memories.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-[#1f2937] p-10 text-center">
          <p className="text-[#9ca3af]">No memories found.</p>
          <p className="mt-1 text-sm text-[#6b7280]">
            Connect an AI via MCP and ask it to remember something, or add one manually.
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {memories.map((m) => (
            <li key={m.id}>
              <Link
                href={`/memories/${m.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-[#1f2937] bg-[#111827] p-4 transition hover:border-[#2563eb]/50 hover:bg-[#16213a]"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-[#1f2937] px-2 py-0.5 text-[#60a5fa]">{typeLabel(m.type)}</span>
                  <span className="text-[#6b7280]">
                    importance {m.importance} · {m.source_provider}
                  </span>
                  <span className="ml-auto text-[#6b7280]">{formatDate(m.updated_at)}</span>
                </div>
                <span className="mt-1 text-sm text-[#e5e9f0]">{truncate(m.content, 160)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
