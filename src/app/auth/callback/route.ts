// OAuth return leg: exchange the code for a session, then route the user by account state.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFeatureSettings } from '@/lib/data/queries';
import { safeNext } from '@/components/public/content';
import type { Profile } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  // Always build redirects on our own origin: `next` is a validated relative path, never a full URL.
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!code) return to('/login?error=oauth');

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (e) {
    console.error('[auth/callback] Supabase is not configured', e);
    return to('/login?error=oauth');
  }

  const { data: session, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !session.user) {
    console.error('[auth/callback] code exchange failed', error?.message);
    return to('/login?error=oauth');
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, disabled, onboarded_at, created_at')
    .eq('id', session.user.id)
    .maybeSingle();
  if (profileError) console.error('[auth/callback] profile lookup failed', profileError.message);
  const profile = profileRow as Pick<Profile, 'id' | 'disabled' | 'onboarded_at' | 'created_at'> | null;

  if (profile?.disabled) {
    await supabase.auth.signOut();
    return to('/login?error=disabled');
  }

  const onboarded = !!profile?.onboarded_at;
  if (!onboarded) {
    // An OAuth attempt can leave an unfinished profile behind. Its age is not admission.
    if (!(await getFeatureSettings()).signups_open) {
      await supabase.auth.signOut();
      return to('/login?error=signups_closed');
    }
    return to('/onboarding');
  }

  return to(next);
}
