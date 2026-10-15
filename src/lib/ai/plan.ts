// Pure validation and repair for AI Assist meal plans. The model proposes; this decides what is safe to save.
import { MEALS, type Diet, type Food, type Meal, type Plan, type PlanItem } from '../nutrition';
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

export type WeekDay = { plan: Plan; kcal: number; rotated: number };

/**
 * Seven days from one day plan. Day 0 is the plan itself, unchanged. Each later day rotates every food to the next
 * interchangeable eligible food (same category and main group), keeps roughly the same calories per item, then
 * repairs the day to within the calorie tolerance. A day that can't be repaired falls back to the day plan.
 * Read-only: nothing here saves.
 */
export function buildWeek(plan: Plan, opts: { eligible: Food[]; targetKcal: number; days?: number }): WeekDay[] {
  const { eligible, targetKcal, days = 7 } = opts;
  const foodsById = new Map(eligible.map(f => [f.id, f]));
  const groups = new Map<string, Food[]>();
  for (const f of [...eligible].sort((a, b) => a.id.localeCompare(b.id))) {
    const k = swapKey(f);
    if (k) groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const base: WeekDay = { plan, kcal: planKcal(plan, foodsById), rotated: 0 };
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
    const repaired = repairPlan(proposed, { foodsById, allowed: f => foodsById.has(f.id), targetKcal });
    if (!repaired.ok) { week.push({ ...base, rotated: 0 }); continue; }
    // Keep each item's "flexible" marker from the day plan, matched by position.
    for (const meal of MEALS) repaired.plan[meal].forEach((i, n) => { i.flex = plan[meal][n]?.flex ?? false; });
    week.push({ plan: repaired.plan, kcal: repaired.kcal, rotated });
  }
  return week;
}
