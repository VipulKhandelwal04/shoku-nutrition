// Disconnects Strava: revokes access at Strava and deletes the stored tokens and imported workouts.
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { disconnect } from '@/lib/strava';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, error: 'Sign in again.' }, { status: 401 });
  try {
    await disconnect(supabase);
    revalidatePath('/app', 'layout');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Couldn’t disconnect Strava. Try again.' }, { status: 500 });
  }
}
