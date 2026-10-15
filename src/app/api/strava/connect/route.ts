// Starts Strava OAuth. Signed-in users only; a one-time state cookie guards the return leg.
import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { isStravaConfigured } from '@/lib/data/queries';
import { STATE_COOKIE, authorizeUrl } from '@/lib/strava';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!isStravaConfigured()) return NextResponse.redirect(new URL('/app/profile?strava=unavailable', origin));
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL('/login?next=/app/profile', origin));

  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authorizeUrl(origin, state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/api/strava' });
  return res;
}
