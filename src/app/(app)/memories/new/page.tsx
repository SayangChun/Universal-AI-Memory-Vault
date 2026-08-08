'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MEMORY_TYPES, MEMORY_TYPE_LABELS, MEMORY_TYPE_EN, type MemoryType } from '@/lib/types';

function typeLabel(t: MemoryType): string {
  return MEMORY_TYPE_LABELS[t] ?? MEMORY_TYPE_EN[t] ?? t;
}

export default function NewMemoryPage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [type, setType] = useState<MemoryType>('fact');
  const [importance, setImportance] = useState(0.6);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, type, importance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to save');
      router.push(`/memories/${data.memory.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/memories" className="text-sm text-[#60a5fa] hover:underline">
        ← Back to memories
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New memory</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">Add a memory manually. AI connectors usually do this via MCP.</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="text-xs font-medium text-[#9ca3af]">
          Content
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="e.g. Prefers dark mode in every app. Allergic to peanuts."
            className="mt-1 w-full rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e9f0] placeholder-[#6b7280] outline-none focus:border-[#2563eb]"
          />
        </label>

        <div className="flex gap-4">
          <label className="flex-1 text-xs font-medium text-[#9ca3af]">
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType)}
              className="mt-1 w-full rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e9f0] outline-none focus:border-[#2563eb]"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-xs font-medium text-[#9ca3af]">
            Importance ({importance.toFixed(1)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="mt-3 w-full accent-[#2563eb]"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="rounded-lg bg-[#2563eb] py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save memory'}
        </button>
      </form>
    </div>
  );
}
