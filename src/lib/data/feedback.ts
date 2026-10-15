'use server';
// Meal feedback ("How it felt"): members rate a logged meal or an Ask Shoku idea. Own rows only (RLS).
import { revalidatePath } from 'next/cache';
import { FLAG_OFF, isOn } from '../flags';
import { feedbackSchema, type FeedbackInput } from '../preferences';
import { SESSION_ENDED, actionUser } from '../auth';
import type { ActionResult } from './diary';
import { getFlags } from './queries';

/** Saves a rating. Rating the same logged food again replaces its earlier rating. */
export async function rateMeal(input: FeedbackInput): Promise<ActionResult<{ id: string }>> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your rating' };
  const f = parsed.data;
  if (!isOn(await getFlags(), 'feedback', f.kind === 'entry' ? 'meals' : 'ideas')) return { ok: false, error: FLAG_OFF };
  const session = await actionUser();
  if (!session) return { ok: false, error: SESSION_ENDED };
  const { supabase, user } = session;

  if (f.entryId) await supabase.from('meal_feedback').delete().eq('entry_id', f.entryId);
  const { data, error } = await supabase.from('meal_feedback').insert({
    user_id: user.id, entry_id: f.entryId ?? null, kind: f.kind, title: f.title, meal: f.meal,
    food_ids: [...new Set(f.foodIds)], rating: f.rating, tags: [...new Set(f.tags)], note: f.note || null,
  }).select('id').single();
  if (error) return { ok: false, error: 'Couldn’t save your rating. Try again.' };
  revalidatePath('/app/profile');
  return { ok: true, data: { id: data.id } };
}

/** Deletes one rating. Always available, even while the feature is switched off. */
export async function deleteRating(id: string): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Nothing to delete' };
  const session = await actionUser();
  if (!session) return { ok: false, error: SESSION_ENDED };
  const { error } = await session.supabase.from('meal_feedback').delete().eq('id', id);
  if (error) return { ok: false, error: 'Couldn’t delete that rating. Try again.' };
  revalidatePath('/app/profile');
  return { ok: true, data: undefined };
}
