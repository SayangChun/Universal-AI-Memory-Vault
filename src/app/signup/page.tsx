import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';

export default function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense>
      <SignupGate searchParams={searchParams} />
    </Suspense>
  );
}

async function SignupGate({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/dashboard';
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0f1c] px-4 text-[#e5e9f0]">
      <AuthForm mode="signup" next={next} />
    </main>
  );
}
