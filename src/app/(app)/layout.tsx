import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { SignOutButton } from '@/components/sign-out-button';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/memories', label: 'Memories' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/settings', label: 'Settings' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-[#0a0f1c] text-[#e5e9f0]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[#1f2937] bg-[#0d1424] p-4 sm:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb] text-sm">UM</span>
          <span>Memory Vault</span>
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
        <div className="mt-auto flex flex-col gap-3 border-t border-[#1f2937] pt-4">
          <div className="truncate px-2 text-xs text-[#6b7280]">{user.email}</div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#1f2937] px-4 py-3 sm:hidden">
          <Link href="/dashboard" className="font-semibold">
            Memory Vault
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/memories" className="text-sm text-[#9ca3af]">Memories</Link>
            <Link href="/settings" className="text-sm text-[#9ca3af]">Settings</Link>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
