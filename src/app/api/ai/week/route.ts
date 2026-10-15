import { weekOutput, weekRequest, type PlanRow, type WeekResponse } from '@/lib/ai/contracts';
import { candidateLines, cuisineBrief, feedbackBrief, mealCandidates } from '@/lib/ai/candidates';
import { generateJson } from '@/lib/ai/gemini';
import { guardAi, recordUsage } from '@/lib/ai/guard';
import { errorResponse, fail, ok, readJson, todayIst } from '@/lib/ai/http';
import { buildWeek, dayTarget, isoWeekday, repairWeek, usualTrainingDays } from '@/lib/ai/plan';
import { WEEK_SYSTEM } from '@/lib/ai/prompts';
import { getFeedbackForSuggestions, getFlags, getFoods } from '@/lib/data/queries';
import { FLAG_OFF, isOn } from '@/lib/flags';
import { GOALS, MEALS, buildPlan, shiftDate, type Meal } from '@/lib/nutrition';
import { OPEN_CUISINES, cuisinePrefsOf } from '@/lib/preferences';
import type { Profile } from '@/lib/types';
import { filterPlan, parseStoredPlan } from '@/components/app/insights/insights';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * POST { preferences (≤ 300 chars) } → { ok: true, data: WeekResponse }.
 * Plan my week: seven days from eligible foods only (meal candidates), with more energy on the member's usual
 * training days. The server repairs every day to its target; a day the model gets wrong falls back to the rotated
 * day plan. Never saves: the member reviews, then saveAiWeek stores the week.
 */
export async function POST(request: Request) {
  if (!isOn(await getFlags(), 'week', 'ai')) return fail(403, FLAG_OFF);
  const guard = await guardAi('week');
  if (!guard.ok) return guard.response;
  const body = await readJson(request, weekRequest);
  if (!body.ok) return body.response;
  const preferences = body.data.preferences;

  const today = todayIst();
  const [{ data: profile }, { data: plans }, { data: workouts, error: wErr }] = await Promise.all([
    guard.supabase.from('profiles').select('*').eq('id', guard.user.id).maybeSingle<Profile>(),
    guard.supabase.from('user_plans').select('plan').maybeSingle(),
    guard.supabase.from('workouts').select('day').eq('hidden', false).gte('day', shiftDate(today, -27)).lte('day', today),
  ]);
  if (!profile?.targets) return fail(409, 'Finish setting up your goal first, then AI Assist can plan your week.');
  if (wErr) return fail(500, 'Couldn’t read your workouts. Try again.');
  const targets = profile.targets;
  const trainingDays = usualTrainingDays((workouts ?? []).map(w => w.day as string), today);

  const flags = await getFlags();
  const foods = await getFoods();
  const cuisines = isOn(flags, 'cuisines', 'plans') ? cuisinePrefsOf(profile) : OPEN_CUISINES;
  const feedback = await getFeedbackForSuggestions(flags, profile);
  const set = mealCandidates(foods, { diet: profile.diet, restrictions: profile.restrictions ?? [], request: preferences, cuisines, feedback });
  if (set.candidates.length < 6) return fail(422, 'Too few foods fit those preferences. Loosen one and try again.');
  const fbBrief = feedbackBrief(set, feedback);

  // Fallback for any day the model gets wrong: the member's day plan, rotated for variety (Monday = first).
  const foodsById = new Map(foods.map(f => [f.id, f]));
  const dayPlan = filterPlan(parseStoredPlan(plans?.plan, foodsById) ?? buildPlan(targets, profile.goal ?? 'fit', profile.diet, foodsById), foodsById, profile.diet, profile.restrictions ?? []);
  const rotated = buildWeek(dayPlan, { eligible: set.candidates.map(c => c.food), targetKcal: targets.kcal });
  const todayWeekday = isoWeekday(today);

  const brief = {
    goal: profile.goal ? GOALS[profile.goal].label : 'Stay fit',
    diet: profile.diet,
    restrictions: profile.restrictions ?? [],
    targets: { protein_g: targets.p, carbs_g: targets.c, fat_g: targets.f },
    targets_by_weekday: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, dayTarget(d, trainingDays, targets.kcal)])),
    trainingDays,
    ...(cuisineBrief(set) ? { cuisines: cuisineBrief(set) } : {}),
    ...(fbBrief ? { feedback: fbBrief } : {}),
  };

  let success = false;
  try {
    const out = await generateJson(weekOutput, {
      system: WEEK_SYSTEM,
      parts: [
        { text: `User: ${JSON.stringify(brief)}` },
        { text: `Preferences:\n<<<\n${preferences || 'none'}\n>>>` },
        { text: `Catalogue (id|name|unit|kcal|protein g|cuisine):\n${candidateLines(set)}` },
      ],
      temperature: 0.6,
      signal: request.signal,
    });
    const week = repairWeek(out.days.map(d => ({ ...d, weekday: Math.round(d.weekday) })), {
      foodsById: set.eligible,
      allowed: f => set.eligible.has(f.id),
      targetKcal: targets.kcal,
      trainingDays,
      fallback: weekday => rotated[(weekday - todayWeekday + 7) % 7].plan,
    });
    if (week.filter(d => d.fallback).length > 3) return fail(502, 'AI Assist couldn’t fit a week to your targets this time. Try again.');
    success = true;
    const days = week.map(d => ({
      weekday: d.weekday, label: LABELS[d.weekday - 1], training: d.training, kcal: d.kcal, target: d.target, plan: d.plan,
      rows: Object.fromEntries(MEALS.map(m => [m, d.plan[m].map((i): PlanRow => {
        const f = set.eligible.get(i.foodId)!;
        return { foodId: f.id, name: f.name, unit: f.unit, icon: f.icon, q: i.q, kcal: Math.round(f.kcal * i.q) };
      })])) as Record<Meal, PlanRow[]>,
    }));
    return ok<WeekResponse>({ days, note: out.note.trim().slice(0, 200) || null, trainingDays, cuisines: set.preferred, feedback: !!fbBrief });
  } catch (err) {
    return errorResponse(err, 'week');
  } finally {
    await recordUsage(guard.supabase, 'week', success);
  }
}
