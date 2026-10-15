import { weekOutput, weekRequest, type WeekResponse } from '@/lib/ai/contracts';
import { candidateLines, recipeLines } from '@/lib/ai/candidates';
import { generateJson } from '@/lib/ai/gemini';
import { guardAi, recordUsage } from '@/lib/ai/guard';
import { errorResponse, fail, ok, readJson, todayIst } from '@/lib/ai/http';
import { memberDayPlan, memberSuggestions, trainingDaysFor } from '@/lib/ai/member';
import { buildWeek, dayTarget, isoWeekday, planRows, repairWeek } from '@/lib/ai/plan';
import { WEEK_SYSTEM } from '@/lib/ai/prompts';
import { getFlags } from '@/lib/data/queries';
import { FLAG_OFF, isOn } from '@/lib/flags';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * POST { preferences (≤ 300 chars) } → { ok: true, data: WeekResponse }.
 * Plan my week: seven days from eligible foods (and recipes) only, with usual training days fuelled with more
 * protein and carbs. Every day is fitted on the server; a day the model gets wrong falls back to the rotated day
 * plan. Never saves: the member reviews, then saveAiWeek stores the week.
 */
export async function POST(request: Request) {
  if (!isOn(await getFlags(), 'week', 'ai')) return fail(403, FLAG_OFF);
  const guard = await guardAi('week');
  if (!guard.ok) return guard.response;
  const body = await readJson(request, weekRequest);
  if (!body.ok) return body.response;
  const preferences = body.data.preferences;

  const today = todayIst();
  const [{ data: profile }, { data: stored }, trainingDays] = await Promise.all([
    guard.supabase.from('profiles').select('*').eq('id', guard.user.id).maybeSingle<Profile>(),
    guard.supabase.from('user_plans').select('plan').maybeSingle(),
    trainingDaysFor(guard.supabase, today),
  ]);
  if (!profile?.targets) return fail(409, 'Finish setting up your goal first, then AI Assist can plan your week.');
  const targets = profile.targets;

  const member = await memberSuggestions(profile, { surface: 'plans', request: preferences });
  const { set } = member;
  if (set.candidates.length < 6) return fail(422, 'Too few foods fit those preferences. Loosen one and try again.');

  // Fallback for any day the model gets wrong: the member's day plan, rotated for variety, starting today.
  const todayWeekday = isoWeekday(today);
  const rotated = buildWeek(memberDayPlan(profile, member, stored?.plan), {
    eligible: set.candidates.map(c => c.food), targetKcal: targets.kcal, trainingDays, startWeekday: todayWeekday,
  });

  const brief = {
    ...member.brief,
    diet: profile.diet,
    restrictions: profile.restrictions ?? [],
    targets: { protein_g: targets.p, carbs_g: targets.c, fat_g: targets.f },
    targets_by_weekday: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, dayTarget(d, trainingDays, targets.kcal)])),
    trainingDays,
  };

  let success = false;
  try {
    const out = await generateJson(weekOutput, {
      system: WEEK_SYSTEM,
      parts: [
        { text: `User: ${JSON.stringify(brief)}` },
        { text: `Preferences:\n<<<\n${preferences || 'none'}\n>>>` },
        { text: `Catalogue (id|name|unit|kcal|protein g|cuisine):\n${candidateLines(set)}` },
        ...(set.recipes.length ? [{ text: `Recipes they can make (name|cuisine|ingredient ids):\n${recipeLines(set.recipes)}` }] : []),
      ],
      temperature: 0.6,
      // Seven days is several times a one-day plan; the route itself may run 60 s.
      timeoutMs: 50_000,
      signal: request.signal,
    });
    const week = repairWeek(out.days.map(d => ({ ...d, weekday: Math.round(d.weekday) })), {
      eligible: set.eligible,
      targetKcal: targets.kcal,
      trainingDays,
      fallback: weekday => rotated[(weekday - todayWeekday + 7) % 7].plan,
    });
    if (week.filter(d => d.fallback).length > 3) return fail(502, 'AI Assist couldn’t fit a week to your targets this time. Try again.');
    success = true;
    const days = week.map(d => ({
      weekday: d.weekday, label: LABELS[d.weekday - 1], training: d.training, kcal: d.kcal, target: d.target, plan: d.plan,
      rows: planRows(d.plan, set.eligible),
    }));
    return ok<WeekResponse>({ days, note: out.note.trim().slice(0, 200) || null, trainingDays, cuisines: set.preferred, feedback: member.usedFeedback });
  } catch (err) {
    return errorResponse(err, 'week');
  } finally {
    await recordUsage(guard.supabase, 'week', success);
  }
}
