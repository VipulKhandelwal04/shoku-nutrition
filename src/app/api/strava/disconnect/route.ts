// Disconnects Strava: revokes access at Strava and deletes the stored tokens and imported workouts.
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { disconnect } from '@/lib/strava';
import { actionUser } from '@/lib/auth';

export async function POST() {
  const session = await actionUser();
  if (!session) return NextResponse.json({ ok: false, error: 'Sign in again.' }, { status: 401 });
  const { supabase, user } = session;
  try {
    await disconnect(supabase, user.id);
    revalidatePath('/app', 'layout');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Couldn’t disconnect Strava. Try again.' }, { status: 500 });
  }
}
