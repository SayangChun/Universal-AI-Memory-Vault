import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { MemoryService } from '@/lib/memory/service';
import { SupabaseMemoryRepo } from '@/lib/memory/supabase-repo';
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_EN, PROVIDER_LABELS } from '@/lib/types';
import { formatDate, truncate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const service = new MemoryService(new SupabaseMemoryRepo(getAdminClient()));
  const stats = await service.stats(user.id);

  const total = stats.total ?? 0;
  const byType = (stats.by_type ?? {}) as Record<string, number>;
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">Your personal memory vault at a glance.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
          <div className="text-xs uppercase tracking-wide text-[#6b7280]">Total memories</div>
          <div className="mt-1 text-3xl font-semibold">{total}</div>
        </div>
        <div className="rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
          <div className="text-xs uppercase tracking-wide text-[#6b7280]">Memory types</div>
          <div className="mt-1 text-3xl font-semibold">{typeEntries.length}</div>
        </div>
        <Link href="/memories" className="rounded-2xl border border-[#2563eb]/40 bg-[#111827] p-5 transition hover:bg-[#16213a]">
          <div className="text-xs uppercase tracking-wide text-[#60a5fa]">Browse memories</div>
          <div className="mt-1 text-3xl font-semibold">→</div>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
          <h2 className="font-semibold">By type</h2>
          {typeEntries.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7280]">No memories yet. Ask an AI connected via MCP to remember something.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {typeEntries.map(([type, count]) => {
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-[#9ca3af]">
                      {MEMORY_TYPE_LABELS[type as keyof typeof MEMORY_TYPE_LABELS] ?? MEMORY_TYPE_EN[type as keyof typeof MEMORY_TYPE_EN] ?? type}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1f2937]">
                      <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-[#6b7280]">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
          <h2 className="font-semibold">Recent memories</h2>
          {stats.recent_memories?.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {stats.recent_memories.map((m) => (
                <li key={m.id}>
                  <Link href={`/memories/${m.id}`} className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 transition hover:bg-[#1f2937]">
                    <span className="text-sm text-[#e5e9f0]">{truncate(m.content, 90)}</span>
                    <span className="text-xs text-[#6b7280]">
                      {MEMORY_TYPE_LABELS[m.type] ?? m.type} · importance {m.importance} · {formatDate(m.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#6b7280]">Nothing here yet.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
        <h2 className="font-semibold">Recent activity</h2>
        {stats.recent_updates?.length ? (
          <ul className="mt-3 flex flex-col gap-2">
            {stats.recent_updates.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#9ca3af]">
                  <span className="rounded bg-[#1f2937] px-1.5 py-0.5 text-xs text-[#e5e9f0]">{a.action}</span>{' '}
                  {PROVIDER_LABELS[a.source_provider] ?? a.source_provider}
                </span>
                <span className="text-xs text-[#6b7280]">{formatDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#6b7280]">No activity yet.</p>
        )}
      </section>
    </div>
  );
}
