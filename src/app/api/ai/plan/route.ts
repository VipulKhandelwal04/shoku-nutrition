import { planOutput, planRequest, type PlanResponse } from '@/lib/ai/contracts';
import { generateJson } from '@/lib/ai/gemini';
import { guardAi, recordUsage, reserveAi } from '@/lib/ai/guard';
import { errorResponse, fail, ok, readJson } from '@/lib/ai/http';
import { candidateLines, recipeLines } from '@/lib/ai/candidates';
import { memberSuggestions } from '@/lib/ai/member';
import { fitDay, planRows, type RepairResult } from '@/lib/ai/plan';
import { PLAN_SYSTEM } from '@/lib/ai/prompts';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST { preferences (≤ 300 chars) } → { ok: true, data: PlanResponse }.
 * Builds a one-day plan from the member's eligible foods only (diet, restrictions, "no X"), leaning toward their
 * cuisines, feedback and recipes, then fits it to within ±10% of the calorie target. Does not save: the client
 * calls saveAiPlan on confirm.
 */
export async function POST(request: Request) {
  const guard = await guardAi('plan');
  if (!guard.ok) return guard.response;
  const body = await readJson(request, planRequest);
  if (!body.ok) return body.response;
  const preferences = body.data.preferences;

  const { data: profile } = await guard.supabase.from('profiles').select('*').eq('id', guard.user.id).maybeSingle<Profile>();
  if (!profile?.targets) return fail(409, 'Finish setting up your goal first, then AI Assist can tailor a plan.');
  const targets = profile.targets;

  const member = await memberSuggestions(profile, { surface: 'plans', request: preferences });
  const { set } = member;
  if (set.candidates.length < 6) return fail(422, 'Too few foods fit those preferences. Loosen one and try again.');

  const brief = {
    ...member.brief,
    diet: profile.diet,
    restrictions: profile.restrictions ?? [],
    targets: { kcal: targets.kcal, protein_g: targets.p, carbs_g: targets.c, fat_g: targets.f },
  };

  const reservation = await reserveAi(guard.supabase, 'plan', guard.settings.daily_quota);
  if (!reservation.ok) return reservation.response;

  let success = false;
  try {
    let result: RepairResult | null = null;
    let note = '';
    // The model gets two tries to land inside the calorie window after server-side repair.
    for (let attempt = 0; attempt < 2 && !result?.ok; attempt++) {
      const out = await generateJson(planOutput, {
        system: PLAN_SYSTEM,
        parts: [
          { text: `User: ${JSON.stringify(brief)}` },
          { text: `Preferences:\n<<<\n${preferences || 'none'}\n>>>` },
          { text: `Catalogue (id|name|unit|kcal|protein g|cuisine):\n${candidateLines(set)}` },
          ...(set.recipes.length ? [{ text: `Recipes they can make (name|cuisine|ingredient ids):\n${recipeLines(set.recipes)}` }] : []),
        ],
        temperature: 0.5,
        signal: request.signal,
      });
      result = fitDay(out.meals, { eligible: set.eligible, targetKcal: targets.kcal });
      note = out.note;
    }
    if (!result?.ok) return fail(502, 'AI Assist couldn’t fit a plan to your target this time. Try again.');

    // Nothing is saved here: the user reviews first, and "Use this plan" calls saveAiPlan.
    success = true;
    return ok<PlanResponse>({
      plan: result.plan, rows: planRows(result.plan, set.eligible), kcal: result.kcal, target: targets.kcal,
      note: note.trim().slice(0, 200) || null, cuisines: set.preferred, feedback: member.usedFeedback,
    });
  } catch (err) {
    return errorResponse(err, 'plan');
  } finally {
    await recordUsage(guard.supabase, 'plan', success, reservation.usageId);
  }
}
