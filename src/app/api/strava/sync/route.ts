// Imports new Strava activities for the signed-in user. Throttled server-side; `{ force: true }` skips the throttle.
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getFlags } from '@/lib/data/queries';
import { FLAG_OFF, isOn } from '@/lib/flags';
import { sync } from '@/lib/strava';
import { actionUser } from '@/lib/auth';

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await actionUser();
  if (!session) return NextResponse.json({ ok: false, error: 'Sign in again.' }, { status: 401 });
  const { supabase, user } = session;
  if (!isOn(await getFlags(), 'apps', 'strava')) return NextResponse.json({ ok: false, error: FLAG_OFF }, { status: 403 });
  const force = await request.json().then((b: { force?: unknown }) => b?.force === true).catch(() => false);
  try {
    const { data: p } = await supabase.from('profiles').select('weight_kg').eq('id', user.id).maybeSingle();
    const result = await sync(supabase, user.id, Number(p?.weight_kg ?? 70), force);
    if (result.imported > 0) revalidatePath('/app', 'layout');
    return NextResponse.json({ ok: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sync failed';
    console.error('[strava/sync]', msg);
    const busy = msg.includes('rate limit');
    return NextResponse.json({ ok: false, error: busy ? 'Strava is busy. Try again in a few minutes.' : 'Couldn’t reach Strava. Try again later.' }, { status: 502 });
  }
}
