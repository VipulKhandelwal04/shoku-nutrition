import 'server-only';
// Everything a suggestion surface needs to know about the member, assembled once: the eligible foods and recipes
// (meal-candidates, with the cuisines and feedback that surface is allowed to use), the prompt brief for those soft
// preferences, their usual training days and their day plan. Ask Shoku, Tune my plan, Plan my week, the week
// actions and Compare all start here, so a new preference is added in one place.
import { getActiveRecipes, getFeedbackForSuggestions, getFlags, getFoods } from '../data/queries';
import { isOn, type FeatureFlags } from '../flags';
import { buildPlan, goalLabel, shiftDate, type Food, type Plan } from '../nutrition';
import { OPEN_CUISINES, cuisinePrefsOf } from '../preferences';
import type { createClient } from '../supabase/server';
import type { FoodRow, Profile } from '../types';
import { cuisineBrief, feedbackBrief, mealCandidates, type CandidateSet } from './candidates';
import { todayIst } from './http';
import { keepEligible, parseStoredPlan, usualTrainingDays } from './plan';

type Supabase = Awaited<ReturnType<typeof createClient>>;
/** Which flag family decides the soft preferences: Ask Shoku, or the plan builders. */
export type Surface = 'ask' | 'plans';

export type MemberSuggestions = {
  set: CandidateSet;
  /** The full catalogue (plus the member's own foods), for display lookups. */
  foodsById: Map<string, Food>;
  flags: FeatureFlags;
  /** The soft part of a prompt brief: goal, and cuisines / feedback when they apply. */
  brief: { goal: string; cuisines?: ReturnType<typeof cuisineBrief>; feedback?: ReturnType<typeof feedbackBrief> };
  /** True when meal feedback reached the brief ("What Shoku used"). */
  usedFeedback: boolean;
};

/**
 * The member's candidates for one surface. Without a `surface` only the hard rules apply (diet, restrictions,
 * "no X"), which is what save actions and Compare need. Recipes join when the Recipes → Meal detail flag is on.
 */
export async function memberSuggestions(profile: Profile, opts: { surface?: Surface; request?: string; recipes?: boolean } = {}): Promise<MemberSuggestions> {
  const { surface, request } = opts;
  const [flags, foods] = await Promise.all([getFlags(), getFoods()]);
  const wantRecipes = (opts.recipes ?? !!surface) && isOn(flags, 'recipes', 'detail');
  const [feedback, recipes] = await Promise.all([
    surface ? getFeedbackForSuggestions(flags, profile) : undefined,
    wantRecipes ? getActiveRecipes() : [],
  ]);
  const cuisines = surface && isOn(flags, 'cuisines', surface) ? cuisinePrefsOf(profile) : OPEN_CUISINES;
  const set = mealCandidates(foods, { diet: profile.diet, restrictions: profile.restrictions ?? [], request, cuisines, feedback, recipes });
  const fb = feedbackBrief(set, feedback);
  const cb = cuisineBrief(set);
  return {
    set,
    foodsById: new Map<string, Food>(foods.map((f: FoodRow) => [f.id, f])),
    flags,
    brief: { goal: goalLabel(profile.goal), ...(cb ? { cuisines: cb } : {}), ...(fb ? { feedback: fb } : {}) },
    usedFeedback: !!fb,
  };
}

/** The member's day plan: their saved (AI-tailored) plan, or the template for their diet, eligible foods only. */
export function memberDayPlan(profile: Profile, ctx: Pick<MemberSuggestions, 'set' | 'foodsById'>, stored: unknown): Plan {
  const plan = parseStoredPlan(stored, ctx.foodsById) ?? buildPlan(profile.targets!, profile.goal ?? 'fit', profile.diet, ctx.foodsById);
  return keepEligible(plan, ctx.set.eligible);
}

/** Usual training days (ISO weekdays) from the last four weeks of visible workouts, as of today in India. */
export async function trainingDaysFor(supabase: Supabase, today = todayIst()): Promise<number[]> {
  const { data } = await supabase.from('workouts').select('day').eq('hidden', false).gte('day', shiftDate(today, -27)).lte('day', today);
  return usualTrainingDays((data ?? []).map(w => w.day as string), today);
}
