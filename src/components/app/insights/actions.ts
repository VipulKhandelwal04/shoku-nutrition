'use server';
// Goal and target mutations shared by Compare and Profile. Run as the signed-in user under RLS.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { recommend, type Targets } from '@/lib/nutrition';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { bodyOf, pickTargets } from './insights';
import { firstIssue, targetsSchema } from './schemas';

export type InsightsResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

const SIGNED_OUT = 'Your session ended. Sign in again.';

/** Changes the goal. Targets stay as they are; the caller offers "Use recommended targets" when they differ. */
export async function setGoal(goal: string): Promise<InsightsResult<{ recommended: Targets | null }>> {
  const parsed = z.enum(['lose', 'fit', 'muscle']).safeParse(goal);
  if (!parsed.success) return { ok: false, error: 'Pick one of the three goals.' };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const { data, error } = await supabase.from('profiles').update({ goal: parsed.data }).eq('id', user.id).select('*').single();
  if (error || !data) return { ok: false, error: 'Couldn’t change your goal. Try again.' };
  const body = bodyOf(data as Profile);
  revalidatePath('/app', 'layout');
  return { ok: true, data: { recommended: body ? pickTargets(recommend(body)) : null } };
}

/** Replaces targets with the recommendation for the saved profile. Returns the previous targets (for Undo). */
export async function applyRecommendedTargets(): Promise<InsightsResult<{ targets: Targets; previous: Targets | null }>> {
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const { data: row } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = row as Profile | null;
  const body = profile ? bodyOf(profile) : null;
  if (!profile || !body) return { ok: false, error: 'Add your goal, age, height, weight and activity first.' };
  const targets = pickTargets(recommend(body));
  const { error } = await supabase.from('profiles').update({ targets }).eq('id', user.id);
  if (error) return { ok: false, error: 'Couldn’t update your targets. Try again.' };
  revalidatePath('/app', 'layout');
  return { ok: true, data: { targets, previous: profile.targets } };
}

/** Saves targets the user typed (or restores previous ones for Undo). */
export async function saveTargets(input: z.input<typeof targetsSchema>): Promise<InsightsResult<{ targets: Targets }>> {
  const parsed = targetsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const { error } = await supabase.from('profiles').update({ targets: parsed.data }).eq('id', user.id);
  if (error) return { ok: false, error: 'Couldn’t save your targets. Try again.' };
  revalidatePath('/app', 'layout');
  return { ok: true, data: { targets: parsed.data } };
}
