import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: '仪表盘' },
  { href: '/memories', label: '记忆列表' },
  { href: '/integrations', label: '平台集成' },
  { href: '/settings', label: '系统设置' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0f1c] text-[#e5e9f0]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[#1f2937] bg-[#0d1424] p-4 sm:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb] text-sm">UM</span>
          <span>通用 AI 记忆库</span>
        </Link>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-[#9ca3af] transition hover:bg-[#1f2937] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#1f2937] px-4 py-3 sm:hidden">
          <Link href="/dashboard" className="font-semibold">
            通用 AI 记忆库
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/memories" className="text-sm text-[#9ca3af]">记忆列表</Link>
            <Link href="/settings" className="text-sm text-[#9ca3af]">系统设置</Link>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
