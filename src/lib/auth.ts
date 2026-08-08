// Auth helpers shared by route handlers and server components.
import { createServerSupabase } from './supabase/server';

export interface SessionUser {
  id: string;
  email: string | undefined;
}

/** Returns the currently signed-in user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}
