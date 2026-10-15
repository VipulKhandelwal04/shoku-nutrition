'use server';
// Week plan edits (#9, #10): one saved day per weekday. The server re-checks every food against the member's diet
// and restrictions and fits each day (usual training days fuelled) before saving. Own rows only (RLS).
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { planSchema } from '../ai/contracts';
import { memberSuggestions, trainingDaysFor } from '../ai/member';
import { fitDay, toProposal } from '../ai/plan';
import { SESSION_ENDED, actionUser } from '../auth';
import { FLAG_OFF, isOn } from '../flags';
import type { Plan } from '../nutrition';
import type { Profile } from '../types';
import type { ActionResult } from './diary';
import { getFlags } from './queries';

const weekday = z.number().int().min(1).max(7);

export type SavedWeekDay = { weekday: number; plan: Plan };

type Session = NonNullable<Awaited<ReturnType<typeof actionUser>>>;

/** Fits each day for the signed-in member (eligible foods, their target, training days) and upserts them. */
async function fitAndSave(session: Session, days: { weekday: number; plan: Plan }[]): Promise<ActionResult<{ saved: SavedWeekDay[]; previous: SavedWeekDay[] }>> {
  const { supabase, user } = session;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  if (!profile?.targets) return { ok: false, error: 'Finish setting up your goal first.' };
  const [{ set }, trainingDays] = await Promise.all([memberSuggestions(profile), trainingDaysFor(supabase)]);

  const saved: SavedWeekDay[] = [];
  for (const d of days) {
    const r = fitDay(toProposal(d.plan), { eligible: set.eligible, targetKcal: profile.targets.kcal, training: trainingDays.includes(d.weekday) });
    if (!r.ok) return { ok: false, error: days.length > 1 ? 'One of those days no longer fits your targets. Build the week again.' : 'That swap would take the day too far from your target. Try another.' };
    saved.push({ weekday: d.weekday, plan: r.plan });
  }

  const { data: before } = await supabase.from('week_plans').select('weekday, plan').in('weekday', saved.map(d => d.weekday));
  const now = new Date().toISOString();
  const { error } = await supabase.from('week_plans').upsert(saved.map(d => ({ user_id: user.id, weekday: d.weekday, plan: d.plan, updated_at: now })));
  if (error) return { ok: false, error: 'Couldn’t save that. Try again.' };
  revalidatePath('/app/compare');
  return { ok: true, data: { saved, previous: (before ?? []).map(b => ({ weekday: Number(b.weekday), plan: b.plan as Plan })) } };
}

/** Saves one day of the week (a swapped meal). Returns the fitted plan and what was saved before (for Undo). */
export async function saveWeekDay(input: { weekday: number; plan: Plan }): Promise<ActionResult<{ plan: Plan; previous: Plan | null }>> {
  if (!isOn(await getFlags(), 'week', 'edit')) return { ok: false, error: FLAG_OFF };
  const parsed = z.object({ weekday, plan: planSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Couldn’t save that day. Refresh and try again.' };
  const session = await actionUser();
  if (!session) return { ok: false, error: SESSION_ENDED };
  const r = await fitAndSave(session, [parsed.data]);
  if (!r.ok) return r;
  return { ok: true, data: { plan: r.data.saved[0].plan, previous: r.data.previous[0]?.plan ?? null } };
}

/**
 * "Use this week" after Plan my week: saves all seven days at once, each re-checked and fitted here again.
 * Returns the days saved before, for Undo.
 */
export async function saveAiWeek(input: { days: SavedWeekDay[] }): Promise<ActionResult<{ previous: SavedWeekDay[] }>> {
  if (!isOn(await getFlags(), 'week', 'ai')) return { ok: false, error: FLAG_OFF };
  const parsed = z.object({ days: z.array(z.object({ weekday, plan: planSchema })).min(1).max(7) }).safeParse(input);
  if (!parsed.success || new Set(parsed.data.days.map(d => d.weekday)).size !== parsed.data.days.length) {
    return { ok: false, error: 'That week looks incomplete. Build it again.' };
  }
  const session = await actionUser();
  if (!session) return { ok: false, error: SESSION_ENDED };
  // Undo must restore every saved day, not only the ones this week overwrites.
  const { data: all } = await session.supabase.from('week_plans').select('weekday, plan');
  const r = await fitAndSave(session, parsed.data.days);
  if (!r.ok) return r;
  return { ok: true, data: { previous: (all ?? []).map(b => ({ weekday: Number(b.weekday), plan: b.plan as Plan })) } };
}

/** "Back to suggested": forgets the saved day. Always available, even with editing switched off. */
export async function resetWeekDay(day: number): Promise<ActionResult> {
  if (!weekday.safeParse(day).success) return { ok: false, error: 'Pick a day.' };
  const session = await actionUser();
  if (!session) return { ok: false, error: SESSION_ENDED };
  const { error } = await session.supabase.from('week_plans').delete().eq('weekday', day);
  if (error) return { ok: false, error: 'Couldn’t reset that day. Try again.' };
  revalidatePath('/app/compare');
  return { ok: true, data: undefined };
}

/** Undo for a single-day save: put back what was there before (a saved day, or nothing). */
export async function restoreWeekDay(input: { weekday: number; previous: Plan | null }): Promise<ActionResult> {
  if (!input.previous) return resetWeekDay(input.weekday);
  const r = await saveWeekDay({ weekday: input.weekday, plan: input.previous });
  return r.ok ? { ok: true, data: undefined } : r;
}

/** Undo for saveAiWeek: the saved days go back to exactly what was there before. */
export async function restoreWeekPlans(previous: SavedWeekDay[]): Promise<ActionResult> {
  const parsed = z.array(z.object({ weekday, plan: z.record(z.string(), z.unknown()) })).max(7).safeParse(previous);
  if (!parsed.success) return { ok: false, error: 'Couldn’t undo that.' };
  const session = await actionUser();
  if (!session) return { ok: false, error: SESSION_ENDED };
  const { supabase, user } = session;
  const { error: delErr } = await supabase.from('week_plans').delete().eq('user_id', user.id);
  if (delErr) return { ok: false, error: 'Couldn’t undo that. Try again.' };
  if (parsed.data.length) {
    const { error } = await supabase.from('week_plans').insert(parsed.data.map(d => ({ user_id: user.id, weekday: d.weekday, plan: d.plan })));
    if (error) return { ok: false, error: 'Couldn’t undo that. Try again.' };
  }
  revalidatePath('/app/compare');
  return { ok: true, data: undefined };
}
