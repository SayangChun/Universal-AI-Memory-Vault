// Server-side Supabase client that reads the user session from cookies.
// Use in server components, route handlers and server actions.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerEnv } from '../env';

export async function createServerSupabase() {
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore, session refresh
          // happens on the next navigation/route handler.
        }
      },
    },
  });
}
