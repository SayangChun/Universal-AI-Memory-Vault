// Supabase Auth callback: exchanges the PKCE code for a session cookie
// and redirects to the originally-requested page.
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return Response.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin), 302);
    }
  }
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return Response.redirect(new URL(target, url.origin), 302);
}

export const dynamic = 'force-dynamic';
