'use server';
import { revalidatePath } from 'next/cache';
import { recommend, type Targets } from '@/lib/nutrition';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { pickTargets, sameTargets } from '@/components/app/insights/insights';
import { bodySchema, firstIssue, type BodyInput } from '@/components/app/insights/schemas';

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
