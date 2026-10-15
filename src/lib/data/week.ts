'use server';
// Week plan edits (#9): one saved day per weekday. The server re-checks every food against the member's diet and
// restrictions and repairs the day to within the calorie tolerance before saving. Own rows only (RLS).
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mealCandidates } from '../ai/candidates';
import { repairPlan, type ProposedPlan } from '../ai/plan';
import { FLAG_OFF, isOn } from '../flags';
import { MEALS, type Plan } from '../nutrition';
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
  const proposed = Object.fromEntries(MEALS.map(m => [m, parsed.data.plan[m].map(i => ({ foodId: i.foodId, servings: i.q }))])) as ProposedPlan;
  const repaired = repairPlan(proposed, { foodsById: set.eligible, allowed: f => set.eligible.has(f.id), targetKcal: profile.targets.kcal });
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
