'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MEMORY_TYPES,
  MEMORY_TYPE_LABELS,
  MEMORY_TYPE_EN,
  PROVIDER_LABELS,
  type MemoryDetail,
  type MemoryType,
} from '@/lib/types';
import { formatDate } from '@/lib/utils';

function typeLabel(t: MemoryType): string {
  return MEMORY_TYPE_LABELS[t] ?? MEMORY_TYPE_EN[t] ?? t;
}

export function MemoryDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [memory, setMemory] = useState<MemoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [type, setType] = useState<MemoryType>('fact');
  const [importance, setImportance] = useState(0.6);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memories/${id}`);
      if (!res.ok) throw new Error('Failed to load memory');
      const data = await res.json();
      setMemory(data.memory);
      setContent(data.memory.content);
      setType(data.memory.type);
      setImportance(data.memory.importance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/memories/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, type, importance }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? 'Failed to update');
      return;
    }
    setEditing(false);
    void load();
  }

  async function handleDelete() {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message ?? 'Failed to delete');
      return;
    }
    router.push('/memories');
    router.refresh();
  }

  if (loading) return <p className="text-sm text-[#6b7280]">Loading…</p>;
  if (error) return <div className="text-sm text-red-300">{error}</div>;
  if (!memory) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/memories" className="text-sm text-[#60a5fa] hover:underline">
        ← Back to memories
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-[#1f2937] px-2 py-0.5 text-[#60a5fa]">{typeLabel(memory.type)}</span>
        <span className="rounded bg-[#1f2937] px-2 py-0.5 text-[#e5e9f0]">
          {memory.status === 'active' ? 'Active' : 'Superseded'}
        </span>
        <span className="text-[#6b7280]">
          importance {memory.importance} · confidence {memory.confidence} · from {memory.source_provider}
        </span>
        <span className="ml-auto text-[#6b7280]">
          v{memory.version_number ?? 1} · created {formatDate(memory.created_at)}
        </span>
      </div>

      {!editing ? (
        <p className="mt-5 whitespace-pre-wrap rounded-2xl border border-[#1f2937] bg-[#111827] p-5 text-[#e5e9f0]">
          {memory.content}
        </p>
      ) : (
        <form onSubmit={handleUpdate} className="mt-5 flex flex-col gap-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-[#2563eb]/50 bg-[#0f172a] px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType)}
              className="rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-1.5 text-sm outline-none"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="w-24 rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-1.5 text-sm outline-none"
            />
            <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-1.5 text-sm font-medium text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-[#374151] px-4 py-1.5 text-sm text-[#9ca3af]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex items-center gap-3">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-[#374151] px-4 py-1.5 text-sm text-[#e5e9f0] hover:bg-[#1f2937]"
          >
            Edit
          </button>
        )}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-red-500/40 px-4 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-1.5">
            <span className="text-sm text-red-300">Permanently delete?</span>
            <button onClick={handleDelete} className="rounded bg-red-500/20 px-3 py-1 text-sm font-medium text-red-300">
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-[#9ca3af]">
              Cancel
            </button>
          </div>
        )}
      </div>

      {memory.supersedes_memory_id && (
        <p className="mt-4 text-xs text-[#6b7280]">
          Supersedes{' '}
          <Link href={`/memories/${memory.supersedes_memory_id}`} className="text-[#60a5fa] hover:underline">
            memory {memory.supersedes_memory_id}
          </Link>
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Version history</h2>
        {memory.versions.length === 0 ? (
          <p className="mt-2 text-sm text-[#6b7280]">Only one version exists.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {[...memory.versions].reverse().map((v) => (
              <li key={v.version_number} className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#60a5fa]">v{v.version_number}</span>
                  <span className="text-[#6b7280]">
                    {PROVIDER_LABELS[v.changed_by_provider] ?? v.changed_by_provider} · {formatDate(v.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#e5e9f0]">{v.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Audit trail</h2>
        {memory.audit.length === 0 ? (
          <p className="mt-2 text-sm text-[#6b7280]">No audit entries.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {memory.audit.map((a, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-[#0d1424] px-3 py-2 text-sm">
                <span className="text-[#9ca3af]">
                  <span className="rounded bg-[#1f2937] px-1.5 py-0.5 text-xs">{a.action}</span>{' '}
                  {PROVIDER_LABELS[a.source_provider] ?? a.source_provider}
                </span>
                <span className="text-xs text-[#6b7280]">{formatDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
