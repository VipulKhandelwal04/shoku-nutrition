'use server';
// Week plan edits (#9): one saved day per weekday. The server re-checks every food against the member's diet and
// restrictions and repairs the day to within the calorie tolerance before saving. Own rows only (RLS).
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mealCandidates } from '../ai/candidates';
import { dayTarget, repairPlan, usualTrainingDays, type ProposedPlan } from '../ai/plan';
import { todayIst } from '../ai/http';
import { FLAG_OFF, isOn } from '../flags';
import { MEALS, shiftDate, type Plan } from '../nutrition';
import { createClient } from '../supabase/server';
import type { Profile } from '../types';
import type { ActionResult } from './diary';
import { getFlags, getFoods } from './queries';

const weekday = z.number().int().min(1).max(7);
const item = z.object({ foodId: z.string().min(1).max(80), q: z.number().positive().max(20), flex: z.boolean().optional() });
const planSchema = z.object(Object.fromEntries(MEALS.map(m => [m, z.array(item).max(8)])) as Record<(typeof MEALS)[number], z.ZodArray<typeof item>>);

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

/** The member's usual training days (ISO weekdays), from the last four weeks of visible workouts. */
async function trainingDaysFor(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number[]> {
  const today = todayIst();
  const { data } = await supabase.from('workouts').select('day').eq('hidden', false).gte('day', shiftDate(today, -27)).lte('day', today);
  return usualTrainingDays((data ?? []).map(w => w.day as string), today);
}

/** Saves a day of the week. Returns the repaired plan and what was saved before (for Undo). */
export async function saveWeekDay(input: { weekday: number; plan: Plan }): Promise<ActionResult<{ plan: Plan; kcal: number; previous: Plan | null }>> {
  if (!isOn(await getFlags(), 'week', 'edit')) return { ok: false, error: FLAG_OFF };
  const parsed = z.object({ weekday, plan: planSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Couldn’t save that day. Refresh and try again.' };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  if (!profile?.targets) return { ok: false, error: 'Finish setting up your goal first.' };
  const set = mealCandidates(await getFoods(), { diet: profile.diet, restrictions: profile.restrictions ?? [] });
  const trainingDays = await trainingDaysFor(supabase);
  const proposed = Object.fromEntries(MEALS.map(m => [m, parsed.data.plan[m].map(i => ({ foodId: i.foodId, servings: i.q }))])) as ProposedPlan;
  const repaired = repairPlan(proposed, { foodsById: set.eligible, allowed: f => set.eligible.has(f.id), targetKcal: dayTarget(parsed.data.weekday, trainingDays, profile.targets.kcal) });
  if (!repaired.ok) return { ok: false, error: 'That swap would take the day too far from your target. Try another.' };

  const { data: before } = await supabase.from('week_plans').select('plan').eq('weekday', parsed.data.weekday).maybeSingle();
  const { error } = await supabase.from('week_plans').upsert({
    user_id: user.id, weekday: parsed.data.weekday, plan: repaired.plan, updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: 'Couldn’t save that day. Try again.' };
  revalidatePath('/app/compare');
  return { ok: true, data: { plan: repaired.plan, kcal: repaired.kcal, previous: (before?.plan as Plan | undefined) ?? null } };
}

/** "Back to suggested": forgets the saved day. Always available, even with editing switched off. */
export async function resetWeekDay(day: number): Promise<ActionResult> {
  if (!weekday.safeParse(day).success) return { ok: false, error: 'Pick a day.' };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { error } = await supabase.from('week_plans').delete().eq('weekday', day);
  if (error) return { ok: false, error: 'Couldn’t reset that day. Try again.' };
  revalidatePath('/app/compare');
  return { ok: true, data: undefined };
}

/** Undo for a save: put back what was there before (a saved day, or nothing). */
export async function restoreWeekDay(input: { weekday: number; previous: Plan | null }): Promise<ActionResult> {
  if (!input.previous) return resetWeekDay(input.weekday);
  const r = await saveWeekDay({ weekday: input.weekday, plan: input.previous });
  return r.ok ? { ok: true, data: undefined } : r;
}

export type SavedWeekDay = { weekday: number; plan: Plan };

/**
 * "Use this week" after Plan my week: saves all seven days at once. Each day is re-checked against the member's
 * diet and restrictions and repaired to that day's target (usual training days higher), computed here again.
 * Returns the days saved before, for Undo.
 */
export async function saveAiWeek(input: { days: SavedWeekDay[] }): Promise<ActionResult<{ previous: SavedWeekDay[] }>> {
  if (!isOn(await getFlags(), 'week', 'ai')) return { ok: false, error: FLAG_OFF };
  const parsed = z.object({ days: z.array(z.object({ weekday, plan: planSchema })).min(1).max(7) }).safeParse(input);
  if (!parsed.success || new Set(parsed.data.days.map(d => d.weekday)).size !== parsed.data.days.length) {
    return { ok: false, error: 'That week looks incomplete. Build it again.' };
  }
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  if (!profile?.targets) return { ok: false, error: 'Finish setting up your goal first.' };

  const trainingDays = await trainingDaysFor(supabase);
  const set = mealCandidates(await getFoods(), { diet: profile.diet, restrictions: profile.restrictions ?? [] });

  const rows = [];
  for (const d of parsed.data.days) {
    const proposed = Object.fromEntries(MEALS.map(m => [m, d.plan[m].map(i => ({ foodId: i.foodId, servings: i.q }))])) as ProposedPlan;
    const r = repairPlan(proposed, { foodsById: set.eligible, allowed: f => set.eligible.has(f.id), targetKcal: dayTarget(d.weekday, trainingDays, profile.targets.kcal) });
    if (!r.ok) return { ok: false, error: 'One of those days no longer fits your targets. Build the week again.' };
    rows.push({ user_id: user.id, weekday: d.weekday, plan: r.plan, updated_at: new Date().toISOString() });
  }

  const { data: before } = await supabase.from('week_plans').select('weekday, plan');
  const { error } = await supabase.from('week_plans').upsert(rows);
  if (error) return { ok: false, error: 'Couldn’t save your week. Try again.' };
  revalidatePath('/app/compare');
  return { ok: true, data: { previous: (before ?? []).map(b => ({ weekday: Number(b.weekday), plan: b.plan as Plan })) } };
}

/** Undo for saveAiWeek: the saved days go back to exactly what was there before. */
export async function restoreWeekPlans(previous: SavedWeekDay[]): Promise<ActionResult> {
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const parsed = z.array(z.object({ weekday, plan: z.record(z.string(), z.unknown()) })).max(7).safeParse(previous);
  if (!parsed.success) return { ok: false, error: 'Couldn’t undo that.' };
  const { error: delErr } = await supabase.from('week_plans').delete().eq('user_id', user.id);
  if (delErr) return { ok: false, error: 'Couldn’t undo that. Try again.' };
  if (parsed.data.length) {
    const { error } = await supabase.from('week_plans').insert(parsed.data.map(d => ({ user_id: user.id, weekday: d.weekday, plan: d.plan })));
    if (error) return { ok: false, error: 'Couldn’t undo that. Try again.' };
  }
  revalidatePath('/app/compare');
  return { ok: true, data: undefined };
}
