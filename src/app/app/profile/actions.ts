'use server';
import { revalidatePath } from 'next/cache';
import { recommend, type Targets } from '@/lib/nutrition';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { pickTargets, sameTargets } from '@/components/app/insights/insights';
import { bodySchema, firstIssue, type BodyInput } from '@/components/app/insights/schemas';
import type { ActionResult } from '@/lib/data/diary';
import { getFlags } from '@/lib/data/queries';
import { FLAG_OFF, isOn } from '@/lib/flags';
import { activityPrefsSchema, cuisinePrefsSchema, type CuisinePrefs } from '@/lib/preferences';

export type SaveProfileResult =
  | { ok: true; data: { recommended: Targets; differs: boolean } }
  | { ok: false; error: string };

/** Saves goal, body, activity, food style and restrictions. Targets are untouched; the UI offers the new recommendation. */
export async function saveProfile(input: BodyInput): Promise<SaveProfileResult> {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const d = parsed.data;
  const { data, error } = await supabase.from('profiles').update({
    goal: d.goal, sex: d.sex, age: d.age, height_cm: d.height, weight_kg: d.weight, activity: d.activity, diet: d.diet, restrictions: d.restrictions,
  }).eq('id', auth.user.id).select('targets').single();
  if (error) return { ok: false, error: 'Couldn’t save your profile. Try again.' };
  const recommended = pickTargets(recommend(d));
  revalidatePath('/app', 'layout');
  return { ok: true, data: { recommended, differs: !sameTargets((data as Pick<Profile, 'targets'> | null)?.targets, recommended) } };
}

/** Saves cuisine preferences (Profile → Food style). Refused while the Cuisines feature is off. */
export async function saveCuisinePrefs(input: CuisinePrefs): Promise<ActionResult> {
  if (!isOn(await getFlags(), 'cuisines')) return { ok: false, error: FLAG_OFF };
  const parsed = cuisinePrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your cuisines' };
  const d = parsed.data;
  return updatePrefs({ cuisine_mode: d.mode, cuisines: d.mode === 'chosen' ? [...new Set(d.chosen)] : [] }, 'Couldn’t save your cuisines. Try again.');
}

/** Saves the activity-context switches: use workouts in meal ideas, and ask first. */
export async function saveActivityPrefs(input: { useWorkouts: boolean; askFirst: boolean }): Promise<ActionResult> {
  const parsed = activityPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Couldn’t save that setting.' };
  return updatePrefs({ use_workouts: parsed.data.useWorkouts, ask_workouts: parsed.data.askFirst }, 'Couldn’t save that setting. Try again.');
}

/** "Remember meal feedback": whether ratings shape suggestions. Turning it off never deletes ratings. */
export async function saveRememberFeedback(on: boolean): Promise<ActionResult> {
  if (typeof on !== 'boolean') return { ok: false, error: 'Couldn’t save that setting.' };
  return updatePrefs({ remember_feedback: on }, 'Couldn’t save that setting. Try again.');
}

async function updatePrefs(patch: Record<string, unknown>, failMsg: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { error } = await supabase.from('profiles').update(patch).eq('id', auth.user.id);
  if (error) return { ok: false, error: failMsg };
  revalidatePath('/app', 'layout');
  return { ok: true, data: undefined };
}
