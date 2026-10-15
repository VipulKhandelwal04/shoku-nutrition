// Starts Strava OAuth. Signed-in users only; a one-time state cookie guards the return leg.
import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getFlags, isStravaConfigured } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';
import { STATE_COOKIE, authorizeUrl } from '@/lib/strava';
import { actionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!isStravaConfigured() || !isOn(await getFlags(), 'apps', 'strava')) return NextResponse.redirect(new URL('/app/profile?strava=unavailable', origin));
  const session = await actionUser();
  if (!session) return NextResponse.redirect(new URL('/login?next=/app/profile', origin));

  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authorizeUrl(origin, state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/api/strava' });
  return res;
}
