import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { MemoryService } from '@/lib/memory/service';
import { getMemoryRepo, isSupabaseConfigured } from '@/lib/memory/repo-factory';
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_EN, PROVIDER_LABELS } from '@/lib/types';
import { formatDate, truncate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();

  const service = new MemoryService(getMemoryRepo());
  const stats = await service.stats(user.id);
  const isDemo = !isSupabaseConfigured();


  const total = stats.total ?? 0;
  const byType = (stats.by_type ?? {}) as Record<string, number>;
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">仪表盘</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">你的个人 AI 记忆库概览。</p>

      {isDemo && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <span className="font-semibold">演示模式（内存存储）</span> — 未检测到有效的 Supabase 配置，当前使用临时内存存储。
          数据在服务器重启后会丢失。请在{' '}
          <code className="rounded bg-amber-500/20 px-1">.env.local</code>{' '}
          中填写真实的 <code className="rounded bg-amber-500/20 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          和 <code className="rounded bg-amber-500/20 px-1">SUPABASE_SERVICE_ROLE_KEY</code>，然后重启服务器即可切换到持久存储。
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
          <div className="text-xs uppercase tracking-wide text-[#6b7280]">记忆总数</div>
          <div className="mt-1 text-3xl font-semibold">{total}</div>
        </div>
        <div className="rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
          <div className="text-xs uppercase tracking-wide text-[#6b7280]">记忆类型数</div>
          <div className="mt-1 text-3xl font-semibold">{typeEntries.length}</div>
        </div>
        <Link href="/memories" className="rounded-2xl border border-[#2563eb]/40 bg-[#111827] p-5 transition hover:bg-[#16213a]">
          <div className="text-xs uppercase tracking-wide text-[#60a5fa]">浏览所有记忆</div>
          <div className="mt-1 text-3xl font-semibold">→</div>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
          <h2 className="font-semibold">类型分布</h2>
          {typeEntries.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b7280]">暂无记忆。可以通过 MCP 连接的 AI 助手记住新内容。</p>
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
          <h2 className="font-semibold">最近记忆</h2>
          {stats.recent_memories?.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {stats.recent_memories.map((m) => (
                <li key={m.id}>
                  <Link href={`/memories/${m.id}`} className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 transition hover:bg-[#1f2937]">
                    <span className="text-sm text-[#e5e9f0]">{truncate(m.content, 90)}</span>
                    <span className="text-xs text-[#6b7280]">
                      {MEMORY_TYPE_LABELS[m.type] ?? m.type} · 重要度 {m.importance} · {formatDate(m.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#6b7280]">暂无记忆。</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
        <h2 className="font-semibold">最近活动</h2>
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
          <p className="mt-3 text-sm text-[#6b7280]">暂无活动记录。</p>
        )}
      </section>
    </div>
  );
}
