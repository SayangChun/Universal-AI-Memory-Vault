// Repo factory — returns the best available MemoryRepo.
//
// When Supabase is fully configured (real URL + service-role key) the
// production SupabaseMemoryRepo is returned.
//
// When either value is missing or still a placeholder the in-process
// InMemoryMemoryRepo singleton is used instead. This lets the dev server
// start and the dashboard render without any database — data is
// ephemeral (resets on server restart) but everything works.
//
// The factory is a singleton so the same InMemory store is shared across
// every server-component render within the same Node.js process.

import { InMemoryMemoryRepo } from './memory-repo-inmemory';
import type { MemoryRepo } from './repository';

/** Returns true when the env contains a real (non-placeholder) Supabase config. */
export function isSupabaseConfigured(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) return false;
  if (/placeholder/i.test(url) || /placeholder/i.test(key)) return false;
  if (!url.includes('.supabase.co') && !url.startsWith('http')) return false;
  return true;
}

// Singleton InMemory repo — survives across requests in the same process.
let _inMemoryRepo: InMemoryMemoryRepo | null = null;

function getInMemoryRepo(): InMemoryMemoryRepo {
  if (!_inMemoryRepo) _inMemoryRepo = new InMemoryMemoryRepo();
  return _inMemoryRepo;
}

/**
 * Returns the appropriate MemoryRepo for the current environment.
 *
 * - Supabase configured → SupabaseMemoryRepo (production path)
 * - Supabase missing / placeholder → InMemoryMemoryRepo (local dev / demo)
 */
export function getMemoryRepo(): MemoryRepo {
  if (isSupabaseConfigured()) {
    // Lazy-require so the module is never loaded during unit tests / static
    // builds where Supabase credentials are absent.
    const { SupabaseMemoryRepo } = require('./supabase-repo') as typeof import('./supabase-repo');
    const { getAdminClient } = require('../supabase/admin') as typeof import('../supabase/admin');
    return new SupabaseMemoryRepo(getAdminClient());
  }
  return getInMemoryRepo();
}
