'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getFoods } from '@/lib/data/queries';
import { MEALS, type Plan } from '@/lib/nutrition';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { MAX_TEXT } from './contracts';
import { dietAllows } from './plan';

const item = z.object({ foodId: z.string().min(1).max(80), q: z.number().min(0.25).max(20), flex: z.boolean() });
const meal = z.array(item).max(8);
const planSchema = z.object({ Breakfast: meal, Lunch: meal, Snacks: meal, Dinner: meal });

/**
 * Saves an AI Assist plan only after the user taps "Use this plan" (the plan route never writes).
 * Re-checks every food exists and fits the user's diet, so a tampered request can't save junk.
 */
export async function saveAiPlan(plan: Plan, preferences: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, error: 'That plan looks incomplete. Try building it again.' };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Sign in again to save your plan.' };

  const { data: profile } = await supabase.from('profiles').select('diet').eq('id', auth.user.id).maybeSingle<Pick<Profile, 'diet'>>();
  const foodsById = new Map((await getFoods()).map(f => [f.id, f]));
  const fits = MEALS.every(m => parsed.data[m].every(i => {
    const f = foodsById.get(i.foodId);
    return f && (!profile?.diet || dietAllows(profile.diet, f.diet));
  }));
  if (!fits) return { ok: false, error: 'Some foods in that plan aren’t available. Try building it again.' };

  const { error } = await supabase.from('user_plans').upsert({
    user_id: auth.user.id,
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
