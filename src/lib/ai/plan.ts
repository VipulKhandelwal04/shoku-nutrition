// Pure validation and repair for AI Assist meal plans. The model proposes; this decides what is safe to save.
import { MEALS, type Diet, type Food, type Meal, type Plan, type PlanItem } from '../nutrition';
import type { PlanRow } from './contracts';
import { clampServings, normalise, tokens } from './match';

export type ProposedPlan = Record<Meal, { foodId: string; servings: number }[]>;

/** veg eats veg; egg eats veg + egg; nonveg eats everything. */
export function dietAllows(userDiet: Diet, foodDiet: Diet): boolean {
  if (userDiet === 'nonveg') return true;
  if (userDiet === 'egg') return foodDiet !== 'nonveg';
  return foodDiet === 'veg';
}

export type Exclusions = { terms: string[][]; noEgg: boolean; noMeat: boolean; dairy: boolean; nuts: boolean; gluten: boolean; jain: boolean };

const JAIN_TERMS = ['aloo', 'potato', 'onion', 'pyaz', 'garlic', 'lahsun', 'carrot', 'beetroot', 'radish', 'ginger'];
const DAIRY_TERMS = ['milk', 'doodh', 'paneer', 'curd', 'dahi', 'yogurt', 'ghee', 'butter', 'cheese', 'whey', 'buttermilk', 'chaas', 'chai', 'lassi', 'cream'];
const NUT_TERMS = ['nut', 'almond', 'badam', 'peanut', 'mungfali', 'groundnut', 'cashew', 'kaju', 'walnut', 'pista'];
const STOP_AT = new Set(['more', 'less', 'extra', 'please', 'at', 'in', 'for', 'on', 'but', 'than', 'high', 'low', 'only']);
const MEAL_WORDS = new Set(['dinner', 'lunch', 'breakfast', 'snack', 'meal']);
const GLUTEN_TERMS = ['wheat', 'roti', 'chapati', 'phulka', 'bread', 'toast', 'paratha', 'rava', 'sooji', 'semolina', 'maida'];

/**
 * Turns profile restrictions ("jain", "no-onion", "nut allergy") and free-text preferences ("no paneer, more
 * South Indian") into hard exclusions. Only clear negative phrases count; wishes like "more South Indian" are
 * left to the model.
 */
export function parseExclusions(restrictions: string[], preferences = ''): Exclusions {
  const ex: Exclusions = { terms: [], noEgg: false, noMeat: false, dairy: false, nuts: false, gluten: false, jain: false };
  const phrases: string[] = [];
  for (const r of restrictions) phrases.push(normalise(r.replace(/[-_]/g, ' ')));
  for (const raw of preferences.split(/[,;.\n/]+/)) {
    for (const part of normalise(raw.replace(/[-_]/g, ' ')).split(/\b(?:and|but|or)\b/)) phrases.push(part.trim());
  }
  // Restriction tags are exclusions by nature; preferences only when phrased negatively.
  const fromProfile = new Set(restrictions.map(r => normalise(r.replace(/[-_]/g, ' '))));
  for (const p of phrases) {
    if (!p) continue;
    if (/\bjain\b/.test(p)) ex.jain = true;
    if (/\bvegan\b/.test(p)) { ex.dairy = true; ex.noEgg = true; ex.noMeat = true; }
    if (/\b(dairy|lactose)\b/.test(p)) ex.dairy = true;
    if (/\b(nut|nuts|peanut|peanuts)\b.*\b(allerg\w*|free)\b|\b(allerg\w*|no)\b.*\b(nut|nuts|peanut|peanuts)\b/.test(p)) ex.nuts = true;
    if (/\b(gluten|celiac|coeliac)\b/.test(p)) ex.gluten = true;
    if (/\b(eggless|no eggs?|without eggs?)\b/.test(p)) ex.noEgg = true;
    if (/\b(no (meat|chicken|fish|non ?veg))\b/.test(p)) ex.noMeat = true;
    const m = p.match(/\b(?:no|without|avoid|skip|not|zero|exclude)\s+([a-z ]{2,40})/);
    const term = m ? m[1] : fromProfile.has(p) && !/\b(jain|vegan|dairy|lactose|gluten|allerg)/.test(p) ? p : null;
    if (term) {
      // Stop at the first word that starts a new wish ("no paneer more protein") and drop meal names.
      const raw = tokens(term, true);
      const cut = raw.findIndex(w => STOP_AT.has(w));
      const t = (cut === -1 ? raw : raw.slice(0, cut)).filter(w => !MEAL_WORDS.has(w)).slice(0, 3);
      if (t.length) ex.terms.push(t);
    }
  }
  return ex;
}

function foodWords(f: Food): Set<string> {
  return new Set([...tokens(f.name), ...tokens(f.aliases ?? ''), ...tokens(f.id.replace(/-/g, ' '))]);
}

/** True when the food breaks a hard exclusion. Errs on the side of excluding. */
export function isExcluded(f: Food, ex: Exclusions): boolean {
  const words = foodWords(f);
  const hasAny = (list: string[]) => list.some(w => words.has(tokens(w)[0] ?? w));
  if ((ex.noMeat || ex.jain) && f.diet === 'nonveg') return true;
  if ((ex.noEgg || ex.jain) && f.diet === 'egg') return true;
  if (ex.jain && hasAny(JAIN_TERMS)) return true;
  if (ex.dairy && ((f.groups?.milk ?? 0) > 0 || f.category === 'Dairy' || hasAny(DAIRY_TERMS))) return true;
  if (ex.nuts && ((f.groups?.nuts ?? 0) > 0 || hasAny(NUT_TERMS))) return true;
  if (ex.gluten && hasAny(GLUTEN_TERMS)) return true;
  return ex.terms.some(t => t.every(w => words.has(w)));
}

export function planKcal(plan: Plan, foodsById: Map<string, Food>): number {
  return Math.round(MEALS.flatMap(m => plan[m]).reduce((n, i) => n + (foodsById.get(i.foodId)?.kcal ?? 0) * i.q, 0));
}

export const PLAN_TOLERANCE = 0.1;

export type RepairResult =
  | { ok: true; plan: Plan; kcal: number; dropped: number; scaled: boolean }
  | { ok: false; reason: string };

/**
 * Keeps only real, allowed foods; clamps servings; merges duplicates; then nudges portions until the day lands
 * within ±10% of the calorie target. Fails when a main meal is empty or the target can't be reached sensibly.
 */
export function repairPlan(
  proposed: ProposedPlan,
  opts: { foodsById: Map<string, Food>; allowed: (f: Food) => boolean; targetKcal: number },
): RepairResult {
  const { foodsById, allowed, targetKcal } = opts;
  let dropped = 0;
  const plan = {} as Plan;
  for (const meal of MEALS) {
    const items: PlanItem[] = [];
    for (const p of proposed[meal] ?? []) {
      const f = foodsById.get(p.foodId);
      if (!f || !allowed(f)) { dropped++; continue; }
      const dup = items.find(i => i.foodId === f.id);
      if (dup) dup.q = clampServings(dup.q + clampServings(p.servings));
      else items.push({ foodId: f.id, q: clampServings(p.servings), flex: false });
    }
    plan[meal] = items.slice(0, 8);
  }
  if (!plan.Breakfast.length || !plan.Lunch.length || !plan.Dinner.length) {
    return { ok: false, reason: 'The plan was missing a main meal.' };
  }

  const lo = targetKcal * (1 - PLAN_TOLERANCE), hi = targetKcal * (1 + PLAN_TOLERANCE);
  let kcal = planKcal(plan, foodsById);
  if (kcal <= 0) return { ok: false, reason: 'The plan had no calories.' };
  let scaled = false;
  if (kcal < lo || kcal > hi) {
    const k = targetKcal / kcal;
    if (k < 0.5 || k > 2) return { ok: false, reason: 'The plan was too far from your calorie target.' };
    for (const m of MEALS) for (const i of plan[m]) i.q = clampServings(i.q * k);
    scaled = true;
    kcal = planKcal(plan, foodsById);
    // Fine-tune: step the biggest calorie item by a quarter serving at a time.
    for (let step = 0; step < 40 && (kcal < lo || kcal > hi); step++) {
      const all = MEALS.flatMap(m => plan[m]).sort((a, b) => (foodsById.get(b.foodId)!.kcal * b.q) - (foodsById.get(a.foodId)!.kcal * a.q));
      const up = kcal < lo;
      const pick = all.find(i => (up ? i.q < 20 : i.q > 0.25));
      if (!pick) break;
      pick.q = clampServings(pick.q + (up ? 0.25 : -0.25));
      kcal = planKcal(plan, foodsById);
    }
    if (kcal < lo || kcal > hi) return { ok: false, reason: 'The plan was too far from your calorie target.' };
  }
  return { ok: true, plan, kcal, dropped, scaled };
}

// ---------- Week builder ----------

/** Foods that stay put across the week: supplements, cooking fat, drinks and the vegetable side. */
const FIXED_CATEGORIES = new Set(['Cooking', 'Drinks', 'Vegetables']);
const FIXED_IDS = new Set(['whey']);
/** One-pot dishes only swap with each other, never for a staple that sits beside a curry. */
const WHOLE_DISHES = new Set(['khichdi', 'biryani']);
/** Swap count for count (an apple for an orange), not calorie for calorie. */
const SAME_SERVINGS = new Set(['Fruit']);
/** Swap only within the same serving and diet (curd ↔ yogurt, chicken ↔ fish; never eggs → fish at breakfast). */
const BY_UNIT = new Set(['Dairy', 'Protein']);

/** Foods are interchangeable when they share a category and their main food group (rice ↔ chapati, dal ↔ rajma). */
export function swapKey(f: Food): string | null {
  if (FIXED_CATEGORIES.has(f.category) || FIXED_IDS.has(f.id)) return null;
  if (WHOLE_DISHES.has(f.id)) return 'dish';
  const top = Object.entries(f.groups ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  return `${f.category}|${top && (top[1] ?? 0) > 0 ? top[0] : ''}${BY_UNIT.has(f.category) ? `|${f.unit}|${f.diet}` : ''}`;
}

// ---------- Plan shapes, written once ----------

/** A saved plan → the shape repairPlan takes. */
export function toProposal(plan: Plan): ProposedPlan {
  return Object.fromEntries(MEALS.map(m => [m, plan[m].map(i => ({ foodId: i.foodId, servings: i.q }))])) as ProposedPlan;
}

/** Drops plan items the member can't have (not in their eligible foods). */
export function keepEligible(plan: Plan, eligible: Map<string, Food>): Plan {
  return Object.fromEntries(MEALS.map(m => [m, plan[m].filter(i => eligible.has(i.foodId))])) as Plan;
}

/** Display rows for a plan: name, unit, icon and kcal per item. Items whose food is unknown are skipped. */
export function planRows(plan: Plan, foodsById: Map<string, Food>): Record<Meal, PlanRow[]> {
  return Object.fromEntries(MEALS.map(m => [m, plan[m].flatMap((i): PlanRow[] => {
    const f = foodsById.get(i.foodId);
    return f ? [{ foodId: f.id, name: f.name, unit: f.unit, icon: f.icon, q: i.q, kcal: Math.round(f.kcal * i.q) }] : [];
  })])) as Record<Meal, PlanRow[]>;
}

/** A plan read back from the database (user_plans or week_plans): valid items only, or null when nothing is left. */
export function parseStoredPlan(raw: unknown, foodsById: Map<string, Food>): Plan | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const plan = {} as Plan;
  let count = 0;
  for (const meal of MEALS) {
    const list = Array.isArray(src[meal]) ? (src[meal] as unknown[]) : [];
    plan[meal] = list.flatMap((it): PlanItem[] => {
      if (!it || typeof it !== 'object') return [];
      const { foodId, q, flex } = it as Record<string, unknown>;
      if (typeof foodId !== 'string' || !foodsById.has(foodId) || typeof q !== 'number' || !(q > 0) || q > 100) return [];
      return [{ foodId, q, flex: flex === true }];
    });
    count += plan[meal].length;
  }
  return count ? plan : null;
}

// ---------- Fitting a day to a member ----------

/** Training days get this much more energy, as more protein and carbs. */
export const TRAINING_DAY_BOOST = 0.1;
/** Foods that fuel training get little of their energy from fat (dal, rice, roti, curd, eggs; not oil or nuts). */
const FUEL_FAT_SHARE = 0.35;

export type DayRules = {
  /** The member's eligible foods (meal-candidates). Anything else is dropped. */
  eligible: Map<string, Food>;
  /** The base calorie target. */
  targetKcal: number;
  /** A usual training day: the boost is added as protein- and carb-rich food. */
  training?: boolean;
};

export function trainingTarget(targetKcal: number): number {
  return Math.round(targetKcal * (1 + TRAINING_DAY_BOOST));
}

/** The calorie target for one weekday: training days get the boost. */
export function dayTarget(weekday: number, trainingDays: number[], targetKcal: number): number {
  return trainingDays.includes(weekday) ? trainingTarget(targetKcal) : targetKcal;
}

const fuels = (f: Food) => f.kcal > 0 && (f.f * 9) / f.kcal <= FUEL_FAT_SHARE && f.p + f.c > 0;

/** Adds quarter servings of protein- and carb-rich items (most protein + carbs per kcal first) until `extra` kcal is in. */
function addFuel(plan: Plan, foodsById: Map<string, Food>, extra: number): Plan {
  const out = Object.fromEntries(MEALS.map(m => [m, plan[m].map(i => ({ ...i }))])) as Plan;
  const fuel = MEALS.flatMap(m => out[m]).filter(i => { const f = foodsById.get(i.foodId); return !!f && fuels(f); })
    .sort((a, b) => { const fa = foodsById.get(a.foodId)!, fb = foodsById.get(b.foodId)!; return (fb.p + fb.c) / fb.kcal - (fa.p + fa.c) / fa.kcal; });
  let added = 0;
  for (let round = 0; fuel.length && added < extra && round < 40; round++) {
    for (const i of fuel) {
      if (added >= extra) break;
      if (i.q >= 20) continue;
      i.q = clampServings(i.q + 0.25);
      added += foodsById.get(i.foodId)!.kcal * 0.25;
    }
  }
  return out;
}

/**
 * The one way to fit a day to a member: eligible foods only, sensible portions, within the calorie tolerance.
 * On a training day the day is first fitted to the base target, then the boost goes in as protein- and carb-rich
 * food rather than scaling everything (oil and nuts stay put).
 */
export function fitDay(proposed: ProposedPlan, rules: DayRules): RepairResult {
  const { eligible, targetKcal, training = false } = rules;
  const opts = { foodsById: eligible, allowed: (f: Food) => eligible.has(f.id) };
  const base = repairPlan(proposed, { ...opts, targetKcal });
  if (!training) return base;
  const boosted = trainingTarget(targetKcal);
  if (!base.ok) return repairPlan(proposed, { ...opts, targetKcal: boosted });
  const fuelled = addFuel(base.plan, eligible, boosted - base.kcal);
  const kcal = planKcal(fuelled, eligible);
  if (Math.abs(kcal - boosted) <= boosted * PLAN_TOLERANCE) return { ok: true, plan: fuelled, kcal, dropped: base.dropped, scaled: true };
  return repairPlan(toProposal(fuelled), { ...opts, targetKcal: boosted });
}

// ---------- Week builder ----------

export type WeekDay = { plan: Plan; kcal: number; rotated: number; training: boolean };

/** ISO weekday of a YYYY-MM-DD key: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: string): number {
  const d = new Date(`${key}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The ISO weekday `offset` days after `start` (also an ISO weekday). */
export const weekdayAfter = (start: number, offset: number) => ((start - 1 + offset) % 7) + 1;

/**
 * Seven days from one day plan, starting on `startWeekday`. Day 0 is the plan itself, unchanged. Each later day
 * rotates every food to the next interchangeable eligible food (same category and main group), keeps roughly the
 * same calories per item, then is fitted with fitDay (usual training days get their boost). A day that can't be
 * fitted falls back to the day plan. Read-only: nothing here saves.
 */
export function buildWeek(plan: Plan, opts: { eligible: Food[]; targetKcal: number; trainingDays?: number[]; startWeekday?: number; days?: number }): WeekDay[] {
  const { eligible, targetKcal, trainingDays = [], startWeekday = 1, days = 7 } = opts;
  const foodsById = new Map(eligible.map(f => [f.id, f]));
  const groups = new Map<string, Food[]>();
  for (const f of [...eligible].sort((a, b) => a.id.localeCompare(b.id))) {
    const k = swapKey(f);
    if (k) groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const isTraining = (d: number) => trainingDays.includes(weekdayAfter(startWeekday, d));
  const base: WeekDay = { plan, kcal: planKcal(plan, foodsById), rotated: 0, training: isTraining(0) };
  const week: WeekDay[] = [base];

  for (let d = 1; d < days; d++) {
    let rotated = 0;
    const proposed = {} as ProposedPlan;
    for (const meal of MEALS) {
      const used = new Set<string>();
      proposed[meal] = plan[meal].map(item => {
        const orig = foodsById.get(item.foodId);
        const options = orig ? groups.get(swapKey(orig) ?? '') ?? [] : [];
        let pick = orig;
        if (orig && options.length > 1) {
          const start = options.findIndex(f => f.id === orig.id);
          for (let k = 0; k < options.length; k++) {
            const next = options[(start + d + k) % options.length];
            if (!used.has(next.id)) { pick = next; break; }
          }
        }
        if (!pick || !orig) return { foodId: item.foodId, servings: item.q };
        used.add(pick.id);
        if (pick.id === orig.id) return { foodId: orig.id, servings: item.q };
        rotated++;
        // Same calories as the planned item, in the new food's own servings (fruit: same count).
        const servings = SAME_SERVINGS.has(orig.category) || pick.kcal <= 0 ? item.q : (orig.kcal * item.q) / pick.kcal;
        return { foodId: pick.id, servings };
      });
    }
    const training = isTraining(d);
    const fitted = fitDay(proposed, { eligible: foodsById, targetKcal, training });
    if (!fitted.ok) { week.push({ ...base, rotated: 0, training }); continue; }
    // Keep each item's "flexible" marker from the day plan, matched by position.
    for (const meal of MEALS) fitted.plan[meal].forEach((i, n) => { i.flex = plan[meal][n]?.flex ?? false; });
    week.push({ plan: fitted.plan, kcal: fitted.kcal, rotated, training });
  }
  return week;
}

// ---------- Editing the week ----------

/**
 * Replaces one meal of a day plan, then fits the whole day again (the other meals scale a little if needed).
 * Foods the member can't have are dropped. The day passed in is never changed.
 */
export function swapMeal(day: Plan, meal: Meal, items: PlanItem[], rules: DayRules): RepairResult {
  return fitDay(toProposal({ ...day, [meal]: items }), rules);
}

// ---------- AI week (Plan my week) ----------

const WEEKS_LOOKED_AT = 4;

/**
 * Usual training days: ISO weekdays (1 = Monday) with a workout in at least half of the last four weeks.
 * `workoutDays` are the days (YYYY-MM-DD) that had any visible workout; the window is the 28 days up to today.
 */
export function usualTrainingDays(workoutDays: string[], today: string): number[] {
  const end = Date.parse(`${today}T12:00:00Z`);
  const start = end - (WEEKS_LOOKED_AT * 7 - 1) * 86_400_000;
  const perWeekday = new Map<number, Set<string>>();
  for (const day of new Set(workoutDays)) {
    const t = Date.parse(`${day}T12:00:00Z`);
    if (!Number.isFinite(t) || t < start || t > end) continue;
    const wd = isoWeekday(day);
    perWeekday.set(wd, (perWeekday.get(wd) ?? new Set()).add(day));
  }
  return [...perWeekday].filter(([, days]) => days.size >= WEEKS_LOOKED_AT / 2).map(([wd]) => wd).sort((a, b) => a - b);
}

export type ProposedDay = { weekday: number } & Partial<ProposedPlan>;
export type RepairedWeekDay = { weekday: number; plan: Plan; kcal: number; target: number; training: boolean; fallback: boolean };

/**
 * Repairs an AI week: each weekday 1–7 is fitted with fitDay (training days get their boost). A missing or unfixable
 * day falls back to `fallback(weekday)`, fitted the same way. Every returned day holds eligible foods only.
 */
export function repairWeek(
  proposed: ProposedDay[],
  opts: { eligible: Map<string, Food>; targetKcal: number; trainingDays: number[]; fallback: (weekday: number) => Plan },
): RepairedWeekDay[] {
  const { eligible, targetKcal, trainingDays, fallback } = opts;
  return [1, 2, 3, 4, 5, 6, 7].map(weekday => {
    const training = trainingDays.includes(weekday);
    const target = training ? trainingTarget(targetKcal) : targetKcal;
    const rules = { eligible, targetKcal, training };
    const day = proposed.find(d => d.weekday === weekday);
    if (day) {
      const r = fitDay(Object.fromEntries(MEALS.map(m => [m, day[m] ?? []])) as ProposedPlan, rules);
      if (r.ok) return { weekday, plan: r.plan, kcal: r.kcal, target, training, fallback: false };
    }
    const base = keepEligible(fallback(weekday), eligible);
    const r = fitDay(toProposal(base), rules);
    return r.ok
      ? { weekday, plan: r.plan, kcal: r.kcal, target, training, fallback: true }
      : { weekday, plan: base, kcal: planKcal(base, eligible), target, training, fallback: true };
  });
}
