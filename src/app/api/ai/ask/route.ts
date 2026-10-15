import { MAX_IDEAS, hourIst, nextMeal, repairIdeas } from '@/lib/ai/ask';
import { askOutput, askRequest, type AskContext, type AskResponse } from '@/lib/ai/contracts';
import { generateJson } from '@/lib/ai/gemini';
import { guardAi, recordUsage } from '@/lib/ai/guard';
import { errorResponse, fail, ok, readJson, todayIst } from '@/lib/ai/http';
import { candidateLines, cuisineBrief, feedbackBrief, mealCandidates } from '@/lib/ai/candidates';
import { ASK_SYSTEM } from '@/lib/ai/prompts';
import { getFeedbackForSuggestions, getFlags, getFoods } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';
import { OPEN_CUISINES, cuisinePrefsOf } from '@/lib/preferences';
import { GOALS, MEALS, totals } from '@/lib/nutrition';
import type { EntryRow, Profile, WorkoutRow } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DIET_LABEL: Record<string, string> = { veg: 'Vegetarian', egg: 'Vegetarian + egg', nonveg: 'Eats everything' };

/**
 * POST { question (≤ 300 chars), day, useWorkouts? } → { ok: true, data: AskResponse }.
 * Hybrid retrieval: hard filters first (diet, saved restrictions, any "no X" in the question) narrow the catalogue,
 * then Gemini picks from what is left using the user's day (meals, workouts, targets). The server re-checks every
 * food and portion. Read-only: nothing is logged until the user taps an idea.
 * The member's settings decide the soft context: cuisine preferences reorder candidates (flag cuisines.ask), and
 * workouts are left out when "use workouts" is off, or when "ask first" is on and they answered no.
 */
export async function POST(request: Request) {
  const guard = await guardAi('ask');
  if (!guard.ok) return guard.response;
  const body = await readJson(request, askRequest);
  if (!body.ok) return body.response;
  const { question, day, useWorkouts } = body.data;

  const [{ data: profile }, { data: entries, error: eErr }, { data: workouts, error: wErr }] = await Promise.all([
    guard.supabase.from('profiles').select('*').eq('id', guard.user.id).maybeSingle<Profile>(),
    guard.supabase.from('entries').select('meal, food, quantity').eq('day', day),
    guard.supabase.from('workouts').select('label, kind, minutes, kcal, source').eq('day', day).eq('hidden', false),
  ]);
  if (!profile?.targets) return fail(409, 'Finish setting up your goal first, then Ask Shoku can tailor ideas.');
  if (eErr || wErr) return fail(500, 'Couldn’t read your day. Try again.');

  const flags = await getFlags();
  const cuisines = isOn(flags, 'cuisines', 'ask') ? cuisinePrefsOf(profile) : OPEN_CUISINES;
  const feedback = await getFeedbackForSuggestions(flags, profile);
  const set = mealCandidates(await getFoods(), { diet: profile.diet, restrictions: profile.restrictions ?? [], request: question, cuisines, feedback });
  const fbBrief = feedbackBrief(set, feedback);
  if (set.candidates.length < 4) return fail(422, 'Too few foods fit that question. Loosen one condition and ask again.');

  const dayEntries = (entries ?? []) as Pick<EntryRow, 'meal' | 'food' | 'quantity'>[];
  const workoutsUse: AskContext['workoutsUse'] =
    profile.use_workouts === false ? 'off' : profile.ask_workouts && useWorkouts === false ? 'skipped' : 'used';
  const dayWorkouts = workoutsUse === 'used' ? ((workouts ?? []) as Pick<WorkoutRow, 'label' | 'kind' | 'minutes' | 'kcal' | 'source'>[]) : [];
  const eaten = totals(dayEntries);
  const logged = MEALS.filter(m => dayEntries.some(e => e.meal === m));
  const isToday = day === todayIst();

  const context: AskContext = {
    workouts: dayWorkouts.map(w => ({ label: w.label, minutes: w.minutes, kcal: w.kcal })),
    workoutsUse,
    eatenKcal: Math.round(eaten.kcal), targetKcal: profile.targets.kcal,
    eatenProtein: Math.round(eaten.p), targetProtein: profile.targets.p,
    diet: DIET_LABEL[profile.diet] ?? profile.diet,
    avoiding: (profile.restrictions ?? []).slice(0, 6),
    cuisines: set.preferred,
    feedback: !!fbBrief,
  };
  const brief = {
    goal: profile.goal ? GOALS[profile.goal].label : 'Stay fit',
    diet: profile.diet,
    today: isToday,
    nextMeal: isToday ? nextMeal(hourIst(), logged) : 'any',
    mealsLogged: logged,
    eaten: { kcal: context.eatenKcal, protein_g: context.eatenProtein },
    targets: { kcal: context.targetKcal, protein_g: context.targetProtein },
    // Left out entirely (not an empty list) when the member chose not to share workouts, so the model doesn't
    // read "no workouts" as a rest day.
    ...(workoutsUse === 'used' ? { workouts: dayWorkouts.map(w => ({ what: w.label, type: w.kind, minutes: w.minutes, kcal_burned: w.kcal, from: w.source })) } : {}),
    ...(cuisineBrief(set) ? { cuisines: cuisineBrief(set) } : {}),
    ...(fbBrief ? { feedback: fbBrief } : {}),
  };
  const catalogue = candidateLines(set);

  let success = false;
  try {
    const out = await generateJson(askOutput, {
      system: ASK_SYSTEM,
      parts: [
        { text: `User's day: ${JSON.stringify(brief)}` },
        { text: `Question:\n<<<\n${question}\n>>>` },
        { text: `Catalogue (id|name|unit|kcal|protein g|cuisine):\n${catalogue}` },
      ],
      temperature: 0.6,
      signal: request.signal,
    });
    const ideas = repairIdeas(out.ideas.slice(0, MAX_IDEAS + 2), set.eligible);
    const answer = out.answer.replace(/\s+/g, ' ').trim().slice(0, 320);
    if (!answer && !ideas.length) return fail(502, 'Ask Shoku couldn’t find an answer this time. Try rewording.');
    success = true;
    return ok<AskResponse>({ answer, ideas, context });
  } catch (err) {
    return errorResponse(err, 'ask');
  } finally {
    await recordUsage(guard.supabase, 'ask', success);
  }
}
