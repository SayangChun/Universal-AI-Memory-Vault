'use client';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="rounded-lg px-3 py-2 text-left text-sm text-[#9ca3af] transition hover:bg-[#1f2937] hover:text-white"
    >
      Sign out
    </button>
  );
}
