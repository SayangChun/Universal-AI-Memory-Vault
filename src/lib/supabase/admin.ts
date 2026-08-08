// Server-side Supabase client with the service role key.
// SERVER ONLY — never import this from client components.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../env';

let _admin: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
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
