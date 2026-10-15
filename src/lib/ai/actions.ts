'use server';
import { revalidatePath } from 'next/cache';
import { SESSION_ENDED, actionUser } from '@/lib/auth';
import { MEALS, type Plan } from '@/lib/nutrition';
import type { Profile } from '@/lib/types';
import { MAX_TEXT, planSchema } from './contracts';
import { memberSuggestions } from './member';

/**
 * Saves an AI Assist plan only after the user taps "Use this plan" (the plan route never writes).
 * Re-checks every food against the member's eligible foods (diet and restrictions), so a tampered request can't
 * save junk.
 */
export async function saveAiPlan(plan: Plan, preferences: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, error: 'That plan looks incomplete. Try building it again.' };
  const session = await actionUser();
  if (!session) return { ok: false, error: SESSION_ENDED };
  const { supabase, user } = session;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  if (!profile) return { ok: false, error: SESSION_ENDED };
  const { set } = await memberSuggestions(profile);
  if (!MEALS.every(m => parsed.data[m].every(i => set.eligible.has(i.foodId)))) {
    return { ok: false, error: 'Some foods in that plan aren’t available. Try building it again.' };
  }

  const { error } = await supabase.from('user_plans').upsert({
    user_id: user.id,
    plan: parsed.data,
    note: preferences.trim().slice(0, MAX_TEXT) || null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[ai/saveAiPlan]', error.code);
    return { ok: false, error: 'Couldn’t save your plan. Try again.' };
  }
  revalidatePath('/app', 'layout');
  return { ok: true };
}
