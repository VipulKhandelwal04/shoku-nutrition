import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from './supabase/server';
import type { Profile } from './types';

/** Verified user (asks Supabase Auth, does not trust the cookie alone). Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/** Signed in, account active. Use in /app, /onboarding and /admin layouts. */
export async function requireProfile(next = '/app'): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (profile.disabled) redirect('/login?error=disabled');
  return profile;
}

/** Signed in and onboarded; otherwise sends the user to onboarding. */
export async function requireOnboarded(next = '/app'): Promise<Profile> {
  const profile = await requireProfile(next);
  if (!profile.onboarded_at || !profile.targets) redirect('/onboarding');
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile('/admin');
  if (profile.role !== 'admin') redirect('/app');
  return profile;
}
