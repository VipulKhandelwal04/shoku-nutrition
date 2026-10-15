'use server';
// Workout mutations. All run as the signed-in user under RLS.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ACTIVITY, WORKOUT_PRESETS, recommend, type Activity, type Targets } from '../nutrition';
import { createClient } from '../supabase/server';
import type { Profile, WorkoutRow } from '../types';
import type { ActionResult } from './diary';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date');
const KINDS: [string, ...string[]] = ['other', 'strava', ...WORKOUT_PRESETS.map(p => p.kind)];

const addSchema = z.object({
  day,
  kind: z.enum(KINDS),
  label: z.string().trim().min(1, 'Name the workout').max(80, 'Keep the name under 80 characters'),
  minutes: z.number().int('Use whole minutes').min(1, 'At least 1 minute').max(600, 'Up to 600 minutes'),
  kcal: z.number().int().min(0).max(5000, 'Up to 5,000 kcal'),
  kcalSource: z.enum(['estimate', 'device']),
});

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function addWorkout(input: z.input<typeof addSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the workout details.' };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const w = parsed.data;
  const { data, error } = await supabase.from('workouts')
    .insert({ user_id: user.id, day: w.day, kind: w.kind, label: w.label, minutes: w.minutes, kcal: w.kcal, kcal_source: w.kcalSource, source: 'manual' })
    .select('id').single();
  if (error) return { ok: false, error: 'Couldn’t save that workout. Try again.' };
  revalidatePath('/app', 'layout');
  return { ok: true, data: { id: data.id } };
}

/** Manual workouts are deleted; imported ones are hidden so the next sync doesn't bring them back. */
export async function removeWorkout(id: string): Promise<ActionResult<{ restore: WorkoutRow }>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'Couldn’t find that workout.' };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { data: row } = await supabase.from('workouts').select('*').eq('id', id).maybeSingle<WorkoutRow>();
  if (!row) return { ok: false, error: 'Couldn’t find that workout.' };
  const { error } = row.source === 'manual'
    ? await supabase.from('workouts').delete().eq('id', id)
    : await supabase.from('workouts').update({ hidden: true }).eq('id', id);
  if (error) return { ok: false, error: 'Couldn’t remove that workout. Try again.' };
  revalidatePath('/app', 'layout');
  return { ok: true, data: { restore: row } };
}

/** Undo for removeWorkout. */
export async function restoreWorkout(row: WorkoutRow): Promise<ActionResult> {
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { error } = row.source === 'manual'
    ? await supabase.from('workouts').insert({
      id: row.id, user_id: user.id, day: row.day, kind: row.kind, label: row.label, minutes: row.minutes, kcal: row.kcal,
      kcal_source: row.kcal_source, source: 'manual',
    })
    : await supabase.from('workouts').update({ hidden: false }).eq('id', row.id);
  if (error) return { ok: false, error: 'Couldn’t bring it back. Log it again.' };
  revalidatePath('/app', 'layout');
  return { ok: true, data: undefined };
}

/**
 * Logged workouts now carry the exercise, so the base target should not also assume it.
 * Switches the activity level to "light" and recalculates targets. Returns what to restore for Undo.
 */
export async function switchToLightBase(): Promise<ActionResult<{ previous: { activity: Activity; targets: Targets } }>> {
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  if (!p?.targets || !p.activity || !p.sex || !p.age || !p.height_cm || !p.weight_kg || !p.goal) {
    return { ok: false, error: 'Finish your goal and body details first.' };
  }
  const next = recommend({ sex: p.sex, age: Number(p.age), height: Number(p.height_cm), weight: Number(p.weight_kg), activity: 'light', goal: p.goal });
  const targets: Targets = { kcal: next.kcal, p: next.p, c: next.c, f: next.f, water: p.targets.water ?? next.water };
  const { error } = await supabase.from('profiles').update({ activity: 'light', targets }).eq('id', user.id);
  if (error) return { ok: false, error: 'Couldn’t update your targets. Try again.' };
  revalidatePath('/app', 'layout');
  return { ok: true, data: { previous: { activity: p.activity, targets: p.targets } } };
}

export async function restoreBase(previous: { activity: Activity; targets: Targets }): Promise<ActionResult> {
  if (!(previous.activity in ACTIVITY)) return { ok: false, error: 'Couldn’t restore that.' };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { error } = await supabase.from('profiles').update({ activity: previous.activity, targets: previous.targets }).eq('id', user.id);
  if (error) return { ok: false, error: 'Couldn’t restore your targets. Try again.' };
  revalidatePath('/app', 'layout');
  return { ok: true, data: undefined };
}
