import { planOutput, planRequest, type PlanResponse, type PlanRow } from '@/lib/ai/contracts';
import { generateJson } from '@/lib/ai/gemini';
import { guardAi, recordUsage } from '@/lib/ai/guard';
import { errorResponse, fail, ok, readJson } from '@/lib/ai/http';
import { candidateLines, cuisineBrief, mealCandidates } from '@/lib/ai/candidates';
import { repairPlan, type RepairResult } from '@/lib/ai/plan';
import { PLAN_SYSTEM } from '@/lib/ai/prompts';
import { getFlags, getFoods } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';
import { OPEN_CUISINES, cuisinePrefsOf } from '@/lib/preferences';
import { MEALS, GOALS, type Food, type Meal } from '@/lib/nutrition';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST { preferences (≤ 300 chars) } → { ok: true, data: PlanResponse }.
 * Builds a one-day plan from catalogue foods only, enforces diet + restrictions + "no X" preferences server-side,
 * repairs portions to within ±10% of the calorie target. Does not save: the client calls saveAiPlan on confirm.
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

  const cuisines = isOn(await getFlags(), 'cuisines', 'plans') ? cuisinePrefsOf(profile) : OPEN_CUISINES;
  const set = mealCandidates(await getFoods(), { diet: profile.diet, restrictions: profile.restrictions ?? [], request: preferences, cuisines });
  if (set.candidates.length < 6) return fail(422, 'Too few foods fit those preferences. Loosen one and try again.');
  const foodsById = set.eligible;
  const allowed = (f: Food) => set.eligible.has(f.id);

  const brief = {
    goal: profile.goal ? GOALS[profile.goal].label : 'Stay fit',
    diet: profile.diet,
    restrictions: profile.restrictions ?? [],
    targets: { kcal: targets.kcal, protein_g: targets.p, carbs_g: targets.c, fat_g: targets.f },
    ...(cuisineBrief(set) ? { cuisines: cuisineBrief(set) } : {}),
  };
  const catalogue = candidateLines(set);

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
          { text: `Catalogue (id|name|unit|kcal|protein g|cuisine):\n${catalogue}` },
        ],
        temperature: 0.5,
        signal: request.signal,
      });
      result = repairPlan(out.meals, { foodsById, allowed, targetKcal: targets.kcal });
      note = out.note;
    }
    if (!result?.ok) return fail(502, 'AI Assist couldn’t fit a plan to your target this time. Try again.');

    // Nothing is saved here: the user reviews first, and "Use this plan" calls saveAiPlan.
    success = true;

    const rows = Object.fromEntries(MEALS.map(m => [m, result.plan[m].map((i): PlanRow => {
      const f = foodsById.get(i.foodId)!;
      return { foodId: f.id, name: f.name, unit: f.unit, icon: f.icon, q: i.q, kcal: Math.round(f.kcal * i.q) };
    })])) as Record<Meal, PlanRow[]>;
    return ok<PlanResponse>({ plan: result.plan, rows, kcal: result.kcal, target: targets.kcal, note: note.trim().slice(0, 200) || null, cuisines: set.preferred });
  } catch (err) {
    return errorResponse(err, 'plan');
  } finally {
    await recordUsage(guard.supabase, 'plan', success);
  }
}
