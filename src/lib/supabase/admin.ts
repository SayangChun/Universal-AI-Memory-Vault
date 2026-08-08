// Server-side Supabase client with the service role key.
// SERVER ONLY — never import this from client components.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../env';

/** Returns true when a real (non-placeholder) Supabase config is present. */
export function isSupabaseConfigured(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) return false;
  if (/placeholder/i.test(url) || /placeholder/i.test(key)) return false;
  return true;
}

let _admin: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  if (/placeholder/i.test(env.supabaseUrl) || /placeholder/i.test(env.supabaseServiceRoleKey)) {
    throw new Error(
      'Supabase env vars are still placeholders. Update .env.local with real values from your Supabase project.',
    );
  }
  if (!_admin) {
    _admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _admin;
}

/** Like getAdminClient() but returns null instead of throwing when Supabase is not configured. */
export function tryGetAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getAdminClient();
}
