'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase/client';

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setInfo('Check your email to confirm your account (if it is not already confirmed).');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      setInfo('Check your email for a sign-in link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e9f0] placeholder-[#6b7280] outline-none focus:border-[#2563eb]';

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">
        {mode === 'login'
          ? 'Welcome back to your memory vault.'
          : 'Set up your personal memory vault.'}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {info && (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {info}
        </div>
      )}

      <form onSubmit={handlePassword} className="mt-6 flex flex-col gap-3">
        <label className="text-xs font-medium text-[#9ca3af]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-[#9ca3af]">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${inputCls} mt-1`}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-[#2563eb] py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-[#6b7280]">
        <div className="h-px flex-1 bg-[#1f2937]" />
        or
        <div className="h-px flex-1 bg-[#1f2937]" />
      </div>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="w-full rounded-lg border border-[#374151] py-2 text-sm font-medium text-[#e5e9f0] transition hover:bg-[#1f2937] disabled:opacity-50"
      >
        Email me a magic link
      </button>

      <p className="mt-6 text-center text-sm text-[#6b7280]">
        {mode === 'login' ? (
          <>
            New here?{' '}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-[#60a5fa] hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-[#60a5fa] hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
