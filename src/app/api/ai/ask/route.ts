import { MAX_IDEAS, hourIst, nextMeal, repairIdeas } from '@/lib/ai/ask';
import { askOutput, askRequest, type AskContext, type AskResponse } from '@/lib/ai/contracts';
import { generateJson } from '@/lib/ai/gemini';
import { guardAi, recordUsage, reserveAi } from '@/lib/ai/guard';
import { errorResponse, fail, ok, readJson, todayIst } from '@/lib/ai/http';
import { candidateLines, matchRecipe, recipeCard, recipeLines } from '@/lib/ai/candidates';
import { memberSuggestions } from '@/lib/ai/member';
import { ASK_SYSTEM } from '@/lib/ai/prompts';
import { DIET_LABEL, MEALS, totals } from '@/lib/nutrition';
import type { EntryRow, Profile, WorkoutRow } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;


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

  const member = await memberSuggestions(profile, { surface: 'ask', request: question });
  const { set } = member;
  if (set.candidates.length < 4) return fail(422, 'Too few foods fit that question. Loosen one condition and ask again.');

  const dayEntries = (entries ?? []) as Pick<EntryRow, 'meal' | 'food' | 'quantity'>[];
  const workoutsUse: AskContext['workoutsUse'] =
    profile.use_workouts === false ? 'off' : profile.ask_workouts && useWorkouts !== true ? 'skipped' : 'used';
  const dayWorkouts = workoutsUse === 'used' ? ((workouts ?? []) as Pick<WorkoutRow, 'label' | 'kind' | 'minutes' | 'kcal' | 'source'>[]) : [];
  const eaten = totals(dayEntries);
  const logged = MEALS.filter(m => dayEntries.some(e => e.meal === m));
  const isToday = day === todayIst();

  const context: AskContext = {
    workouts: dayWorkouts.map(w => ({ label: w.label, minutes: w.minutes, kcal: w.kcal })),
    workoutsUse,
    eatenKcal: Math.round(eaten.kcal), targetKcal: profile.targets.kcal,
    eatenProtein: Math.round(eaten.p), targetProtein: profile.targets.p,
    diet: DIET_LABEL[profile.diet],
    avoiding: (profile.restrictions ?? []).slice(0, 6),
    cuisines: set.preferred,
    feedback: member.usedFeedback,
  };
  const brief = {
    ...member.brief,
    diet: profile.diet,
    today: isToday,
    nextMeal: isToday ? nextMeal(hourIst(), logged) : 'any',
    mealsLogged: logged,
    eaten: { kcal: context.eatenKcal, protein_g: context.eatenProtein },
    targets: { kcal: context.targetKcal, protein_g: context.targetProtein },
    // Left out entirely (not an empty list) when the member chose not to share workouts, so the model doesn't
    // read "no workouts" as a rest day.
    ...(workoutsUse === 'used' ? { workouts: dayWorkouts.map(w => ({ what: w.label, type: w.kind, minutes: w.minutes, kcal_burned: w.kcal, from: w.source })) } : {}),
  };
  const catalogue = candidateLines(set);

  const reservation = await reserveAi(guard.supabase, 'ask', guard.settings.daily_quota);
  if (!reservation.ok) return reservation.response;

  let success = false;
  try {
    const out = await generateJson(askOutput, {
      system: ASK_SYSTEM,
      parts: [
        { text: `User's day: ${JSON.stringify(brief)}` },
        { text: `Question:\n<<<\n${question}\n>>>` },
        { text: `Catalogue (id|name|unit|kcal|protein g|cuisine):\n${catalogue}` },
        ...(set.recipes.length ? [{ text: `Recipes they can make (name|cuisine|ingredient ids):\n${recipeLines(set.recipes)}` }] : []),
      ],
      temperature: 0.6,
      signal: request.signal,
    });
    const ideas = repairIdeas(out.ideas.slice(0, MAX_IDEAS + 2), set.eligible).map(idea => {
      const match = matchRecipe(idea.items.map(i => i.foodId), set.recipes);
      return match ? { ...idea, recipe: recipeCard(match, member.foodsById) } : idea;
    });
    const answer = out.answer.replace(/\s+/g, ' ').trim().slice(0, 320);
    if (!answer && !ideas.length) return fail(502, 'Ask Shoku couldn’t find an answer this time. Try rewording.');
    success = true;
    return ok<AskResponse>({ answer, ideas, context });
  } catch (err) {
    return errorResponse(err, 'ask');
  } finally {
    await recordUsage(guard.supabase, 'ask', success, reservation.usageId);
  }
}
