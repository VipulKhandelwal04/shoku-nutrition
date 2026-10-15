// Strava OAuth return leg: check state, store tokens, run a first import, then back to the profile.
import { NextResponse, type NextRequest } from 'next/server';
import { getFlags } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';
import { STATE_COOKIE, STRAVA_SCOPE, connect, sync } from '@/lib/strava';
import { actionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/app/profile?strava=${status}`, origin));
    res.cookies.delete({ name: STATE_COOKIE, path: '/api/strava' });
    return res;
  };

  if (!isOn(await getFlags(), 'apps', 'strava')) return back('unavailable');
  const state = searchParams.get('state');
  if (!state || state !== request.cookies.get(STATE_COOKIE)?.value) return back('error');
  if (searchParams.get('error')) return back('cancelled');
  const code = searchParams.get('code');
  const scope = searchParams.get('scope');
  // Activities need activity:read_all (or activity:read); without it there is nothing to import.
  if (!code || !scope?.includes('activity:read')) return back('scope');

  const session = await actionUser();
  if (!session) return NextResponse.redirect(new URL('/login?next=/app/profile', origin));
  const { supabase, user } = session;

  try {
    await connect(user.id, code, scope ?? STRAVA_SCOPE);
  } catch (e) {
    console.error('[strava/callback]', e instanceof Error ? e.message : 'connect failed');
    return back('error');
  }
  try {
    const { data: p } = await supabase.from('profiles').select('weight_kg').eq('id', user.id).maybeSingle();
    await sync(supabase, user.id, Number(p?.weight_kg ?? 70), true);
  } catch (e) {
    // Connected but the first import failed: the next Today visit retries.
    console.error('[strava/callback] first sync', e instanceof Error ? e.message : 'failed');
  }
  return back('connected');
}
