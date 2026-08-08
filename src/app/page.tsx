import Link from 'next/link';

const PROVIDER_MATRIX = [
  { name: 'Claude (claude.ai)', status: '完全支持', statusKey: 'Supported', note: '通过 OAuth 的远程 MCP 连接器 (Free/Pro/Max/Team/Enterprise)' },
  { name: 'ChatGPT (chatgpt.com)', status: '部分支持', statusKey: 'Partial', note: '开发者模式 + 远程 MCP；写入需要 Business/Enterprise/Edu (beta)' },
  { name: 'Gemini (gemini.google.com)', status: '暂不支持', statusKey: 'Unsupported', note: '个人网页端暂无自服务 MCP；请使用 Gemini API/CLI 或 Enterprise' },
] as const;

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0a0f1c] text-[#e5e9f0]">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb] text-sm">UM</span>
          <span>通用 AI 记忆库</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-[#9ca3af] hover:text-white">
            仪表盘
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-medium text-white hover:bg-[#1d4ed8]"
          >
            打开记忆库
          </Link>
        </div>
      </nav>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-16 pb-20 text-center">
        <span className="rounded-full border border-[#1f2937] bg-[#0f172a] px-3 py-1 text-xs text-[#60a5fa]">
          统一记忆层 · 跨 AI 平台
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          为你的 AI 提供长期记忆 —<br />
          完全由你掌控。
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#9ca3af]">
          跨 AI 平台的个人记忆库。Claude、ChatGPT 及其他 AI 平台通过 Model Context Protocol (MCP)
          读写同一个共享记忆库，而<b className="text-[#e5e9f0]">你</b>掌控数据、管理权限并审计每次变更。
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-[#2563eb] px-6 py-3 font-semibold text-white hover:bg-[#1d4ed8]"
          >
            打开你的记忆库
          </Link>
          <a
            href="#providers"
            className="rounded-xl border border-[#374151] px-6 py-3 font-medium text-[#e5e9f0] hover:bg-[#1f2937]"
          >
            AI 平台兼容性
          </a>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-16 sm:grid-cols-3">
        {[
          { t: '通用记忆 Schema', d: '事实、偏好、目标、习惯、人际关系与项目 — 无厂商绑定的中立数据规范。' },
          { t: '版本历史与审计', d: '每次创建、更新与删除均有版本记录与日志，谁在何时修改了什么一目了然。' },
          { t: '原生 MCP 支持', d: '通过 OAuth 暴露 memory_search、create、update、delete 等 MCP 工具，拒绝网页刮取。' },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl border border-[#1f2937] bg-[#111827] p-6">
            <h3 className="font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">{f.d}</p>
          </div>
        ))}
      </section>

      <section id="providers" className="mx-auto w-full max-w-5xl px-6 pb-20">
        <h2 className="text-2xl font-semibold">AI 平台兼容性</h2>
        <p className="mt-2 text-sm text-[#9ca3af]">
          基于官方文档与真实测试的能力矩阵。不支持的功能明确标注，本项目绝不上虚假兼容。
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#1f2937]">
          {PROVIDER_MATRIX.map((p) => (
            <div
              key={p.name}
              className="flex flex-col gap-1 border-b border-[#1f2937] bg-[#111827] p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-[#9ca3af] sm:text-right">{p.note}</div>
              <span
                className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium sm:self-auto ${
                  p.statusKey === 'Supported'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : p.statusKey === 'Partial'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-red-500/15 text-red-300'
                }`}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#1f2937] py-8 text-center text-sm text-[#6b7280]">
        通用 AI 记忆库 — 你的记忆，由你做主。
      </footer>
    </main>
  );
}
