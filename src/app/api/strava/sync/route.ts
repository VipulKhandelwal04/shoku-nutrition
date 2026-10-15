// Imports new Strava activities for the signed-in user. Throttled server-side; `{ force: true }` skips the throttle.
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { sync } from '@/lib/strava';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, error: 'Sign in again.' }, { status: 401 });
  const force = await request.json().then((b: { force?: unknown }) => b?.force === true).catch(() => false);
  try {
    const { data: p } = await supabase.from('profiles').select('weight_kg').eq('id', data.user.id).maybeSingle();
    const result = await sync(supabase, data.user.id, Number(p?.weight_kg ?? 70), force);
    if (result.imported > 0) revalidatePath('/app', 'layout');
    return NextResponse.json({ ok: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sync failed';
    console.error('[strava/sync]', msg);
    const busy = msg.includes('rate limit');
    return NextResponse.json({ ok: false, error: busy ? 'Strava is busy. Try again in a few minutes.' : 'Couldn’t reach Strava. Try again later.' }, { status: 502 });
  }
}
