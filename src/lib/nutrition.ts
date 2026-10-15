// Pure nutrition logic shared by the app, the AI routes and the admin console.
// No I/O here: everything is deterministic so it can be unit tested.

export const MEALS = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'] as const;
export type Meal = (typeof MEALS)[number];

export type Diet = 'veg' | 'egg' | 'nonveg';

/** The catalogue began Indian-only, so a food without a cuisine is Indian. */
export const DEFAULT_CUISINE = 'Indian';
export function cuisineOf(f: Pick<Food, 'cuisine'>): string {
  return f.cuisine?.trim() || DEFAULT_CUISINE;
}
export type GroupKey = 'cer' | 'pul' | 'milk' | 'veg' | 'fruit' | 'nuts' | 'oil';

export type Food = {
  id: string;
  name: string;
  category: string;
  unit: string;
  grams: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fibre: number;
  diet: Diet;
  icon: string;
  aliases: string;
  /** Raw-weight food-group grams (ml for milk) per serving. Empty for custom foods. */
  groups: Partial<Record<GroupKey, number>>;
  custom?: boolean;
  /** e.g. 'Indian', 'Italian'. Missing on seed rows and before the cuisine migration: read it with cuisineOf. */
  cuisine?: string;
};

export type Entry = { id: string; meal: Meal; quantity: number; food: Food };
export type Macros = { kcal: number; p: number; c: number; f: number; fibre: number };
export type Targets = { kcal: number; p: number; c: number; f: number; water: number };

export type Goal = 'lose' | 'fit' | 'muscle';
export type Sex = 'female' | 'male';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high';
export type BodyProfile = { goal: Goal; sex: Sex; age: number; height: number; weight: number; activity: Activity };

export const GOALS: Record<Goal, { label: string; blurb: string }> = {
  lose: { label: 'Lose weight', blurb: 'A gentle deficit, protein held steady.' },
  fit: { label: 'Stay fit', blurb: 'Eat to match what you burn.' },
  muscle: { label: 'Build muscle', blurb: 'A small surplus with more protein.' },
};
/** A member's goal as words; no goal yet reads as "Stay fit". */
export const goalLabel = (goal: Goal | null | undefined) => GOALS[goal ?? 'fit'].label;

/** Short diet names and the chip tone each uses (green veg, amber egg, pink non-veg). */
export const DIET_LABEL: Record<Diet, string> = { veg: 'Veg', egg: 'Egg', nonveg: 'Non-veg' };
export const DIET_TONE: Record<Diet, 'ok' | 'warn' | 'accent'> = { veg: 'ok', egg: 'warn', nonveg: 'accent' };

export const ACTIVITY: Record<Activity, { label: string; factor: number }> = {
  sedentary: { label: 'Mostly sitting', factor: 1.2 },
  light: { label: 'Light · 1–3 workouts a week', factor: 1.375 },
  moderate: { label: 'Moderate · 3–5 workouts a week', factor: 1.55 },
  high: { label: 'Very active · 6–7 workouts a week', factor: 1.725 },
};

/** ICMR-NIN "My Plate for the Day" at 2,000 kcal. kind: limit = stay under, atleast = reach. */
export const GROUPS: { key: GroupKey; label: string; grams: number; kind: 'limit' | 'atleast'; unit: 'g' | 'ml' }[] = [
  { key: 'cer', label: 'Cereals & millets', grams: 250, kind: 'limit', unit: 'g' },
  { key: 'pul', label: 'Pulses, eggs & meat', grams: 85, kind: 'atleast', unit: 'g' },
  { key: 'milk', label: 'Milk & curd', grams: 300, kind: 'atleast', unit: 'ml' },
  { key: 'veg', label: 'Vegetables & greens', grams: 400, kind: 'atleast', unit: 'g' },
  { key: 'fruit', label: 'Fruits', grams: 100, kind: 'atleast', unit: 'g' },
  { key: 'nuts', label: 'Nuts & seeds', grams: 35, kind: 'atleast', unit: 'g' },
  { key: 'oil', label: 'Fats & oils', grams: 27, kind: 'limit', unit: 'g' },
];

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function nutrition(food: Pick<Food, 'kcal' | 'p' | 'c' | 'f' | 'fibre'>, quantity = 1): Macros {
  return {
    kcal: round1((food.kcal || 0) * quantity),
    p: round1((food.p || 0) * quantity),
    c: round1((food.c || 0) * quantity),
    f: round1((food.f || 0) * quantity),
    fibre: round1((food.fibre || 0) * quantity),
  };
}

export function totals(entries: Pick<Entry, 'food' | 'quantity'>[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => {
      const n = nutrition(e.food, e.quantity);
      return { kcal: acc.kcal + n.kcal, p: acc.p + n.p, c: acc.c + n.c, f: acc.f + n.f, fibre: acc.fibre + n.fibre };
    },
    { kcal: 0, p: 0, c: 0, f: 0, fibre: 0 },
  );
}

export function groupTotals(entries: Pick<Entry, 'food' | 'quantity'>[]): Record<GroupKey, number> {
  const g = Object.fromEntries(GROUPS.map(x => [x.key, 0])) as Record<GroupKey, number>;
  for (const e of entries) for (const [k, v] of Object.entries(e.food.groups ?? {})) g[k as GroupKey] += (v ?? 0) * e.quantity;
  return g;
}

export function isValidProfile(p: Partial<BodyProfile> | null | undefined): p is BodyProfile {
  if (!p) return false;
  const inRange = (v: unknown, a: number, b: number) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  return !!p.goal && p.goal in GOALS && (p.sex === 'female' || p.sex === 'male') && !!p.activity && p.activity in ACTIVITY &&
    inRange(p.age, 18, 100) && inRange(p.height, 120, 230) && inRange(p.weight, 30, 300);
}

/** Mifflin-St Jeor energy, ICMR protein (0.83 g/kg; 1.6 g/kg for muscle), 30% fat, WHO fibre floor. */
export function energyRecommendation(pr: BodyProfile) {
  const bmr = 10 * pr.weight + 6.25 * pr.height - 5 * pr.age + (pr.sex === 'female' ? -161 : 5);
  const tdee = bmr * ACTIVITY[pr.activity].factor;
  let kcal = pr.goal === 'lose' ? Math.max(tdee - 500, bmr, 1200) : pr.goal === 'muscle' ? tdee * 1.1 : tdee;
  kcal = Math.round(kcal / 10) * 10;
  if (pr.goal === 'lose') kcal = Math.max(kcal, Math.ceil(Math.max(bmr, 1200) / 10) * 10);
  return { bmr, maintenance: tdee, adjustment: kcal - tdee, kcal };
}

/** Macro targets share the same calorie estimate shown in the recommendation explanation. */
export function recommend(pr: BodyProfile): Targets & { fibre: number; bmi: number } {
  const { kcal } = energyRecommendation(pr);
  const p = Math.round(pr.goal === 'muscle' ? 1.6 * pr.weight : Math.max(0.83 * pr.weight, (kcal * 0.15) / 4));
  const f = Math.round((kcal * 0.3) / 9);
  const c = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
  return { kcal, p, c, f, water: 2500, fibre: 25, bmi: pr.weight / (pr.height / 100) ** 2 };
}

export type GroupStatus = { key: GroupKey; label: string; eaten: number; target: number; unit: 'g' | 'ml'; kind: 'limit' | 'atleast'; status: 'hit' | 'so-far' | 'low' | 'over' };

/**
 * Food groups vs the ICMR-NIN plate scaled to the calorie target.
 * While the day is still open, a shortfall reads "so-far" instead of "low": never shame an unfinished day.
 */
export function groupStatus(entries: Pick<Entry, 'food' | 'quantity'>[], kcalTarget: number, dayOpen: boolean): GroupStatus[] {
  const gt = groupTotals(entries);
  const scale = kcalTarget / 2000;
  return GROUPS.map(g => {
    const target = Math.round(g.grams * scale);
    const eaten = Math.round(gt[g.key]);
    const r = target ? eaten / target : 0;
    let status: GroupStatus['status'];
    if (g.kind === 'limit') status = r <= 1.1 ? 'hit' : 'over';
    else status = r >= 0.9 ? 'hit' : dayOpen ? 'so-far' : 'low';
    return { key: g.key, label: g.label, eaten, target, unit: g.unit, kind: g.kind, status };
  });
}

// ---------- Meal plan ----------

export type PlanItem = { foodId: string; q: number; flex: boolean };
export type Plan = Record<Meal, PlanItem[]>;

/** Example day per diet: [food id, servings, flexible]. Flexible staples scale to the calorie target. */
export const PLAN_TEMPLATES: Record<Diet, Record<Meal, [string, number, 0 | 1][]>> = {
  veg: {
    Breakfast: [['oats', 1, 1], ['milk', 1, 0], ['banana', 1, 0]],
    Lunch: [['chapati', 2, 1], ['dal', 1, 1], ['sabzi', 1, 0], ['curd', 1, 0], ['salad', 1, 0]],
    Snacks: [['sprouts', 1, 1], ['apple', 1, 0], ['almonds', 1, 0]],
    Dinner: [['chapati', 2, 1], ['paneer-bhurji', 1, 1], ['salad', 1, 0]],
  },
  egg: {
    Breakfast: [['egg', 2, 1], ['bread', 2, 1], ['milk', 1, 0]],
    Lunch: [['chapati', 2, 1], ['dal', 1, 1], ['sabzi', 1, 0], ['curd', 1, 0], ['salad', 1, 0]],
    Snacks: [['sprouts', 1, 1], ['apple', 1, 0], ['almonds', 1, 0]],
    Dinner: [['chapati', 2, 1], ['paneer-bhurji', 1, 1], ['salad', 1, 0]],
  },
  nonveg: {
    Breakfast: [['egg', 2, 1], ['bread', 2, 1], ['milk', 1, 0]],
    Lunch: [['rice', 1, 1], ['dal', 1, 1], ['sabzi', 1, 0], ['curd', 1, 0], ['salad', 1, 0]],
    Snacks: [['greek-yogurt', 1, 0], ['apple', 1, 0], ['almonds', 1, 0]],
    Dinner: [['chicken', 1, 1], ['chapati', 2, 1], ['sabzi', 1, 0]],
  },
};

export function buildPlan(target: Pick<Targets, 'kcal'>, goal: Goal, diet: Diet, foodsById: Map<string, Food>): Plan {
  const plan = Object.fromEntries(
    MEALS.map(m => [m, PLAN_TEMPLATES[diet][m].filter(([id]) => foodsById.has(id)).map(([foodId, q, flex]) => ({ foodId, q, flex: !!flex }))]),
  ) as Plan;
  if (goal === 'muscle' && foodsById.has('whey')) plan.Snacks.push({ foodId: 'whey', q: 1, flex: false });
  const kcalOf = (items: PlanItem[]) => items.reduce((n, i) => n + (foodsById.get(i.foodId)?.kcal ?? 0) * i.q, 0);
  const all = MEALS.flatMap(m => plan[m]);
  const flexKcal = kcalOf(all.filter(i => i.flex));
  if (flexKcal > 0) {
    const k = Math.min(2.5, Math.max(0.5, (target.kcal - kcalOf(all.filter(i => !i.flex))) / flexKcal));
    for (const i of all) if (i.flex) i.q = Math.max(0.5, Math.round(i.q * k * 2) / 2);
  }
  // Very low targets: drop fixed snack extras, biggest first, until within 5% of target.
  for (const i of [...plan.Snacks].filter(i => !i.flex).sort((a, b) => (foodsById.get(b.foodId)?.kcal ?? 0) - (foodsById.get(a.foodId)?.kcal ?? 0))) {
    if (kcalOf(MEALS.flatMap(m => plan[m])) <= target.kcal * 1.05) break;
    plan.Snacks.splice(plan.Snacks.indexOf(i), 1);
  }
  return plan;
}

export type PlanItemStatus = 'done' | 'partly' | 'more' | 'next';
export function planCheck(plan: Plan, entries: Pick<Entry, 'meal' | 'food' | 'quantity'>[], foodsById: Map<string, Food>) {
  let done = 0, count = 0;
  const rows = MEALS.map(meal => {
    const logged = entries.filter(e => e.meal === meal);
    const ids = new Set(plan[meal].map(i => i.foodId));
    const items = plan[meal].map(i => {
      const eaten = logged.filter(e => e.food.id === i.foodId).reduce((n, e) => n + e.quantity, 0);
      const ratio = eaten / i.q;
      const status: PlanItemStatus = !eaten ? 'next' : ratio < 0.8 ? 'partly' : ratio > 1.25 ? 'more' : 'done';
      count++;
      if (ratio >= 0.8) done++;
      return { ...i, food: foodsById.get(i.foodId)!, eaten, left: Math.max(0, Math.round((i.q - eaten) * 100) / 100), status };
    });
    const extras = logged.filter(e => !ids.has(e.food.id));
    return { meal, items, extras };
  });
  return { rows, done, count };
}

// ---------- Days and streaks ----------

export const MEALS_FOR_A_COUNTED_DAY = 3;

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function shiftDate(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** A day counts toward the streak once 3 different meals have something logged (like attending a class). */
export function dayCounts(mealsLogged: number): boolean {
  return mealsLogged >= MEALS_FOR_A_COUNTED_DAY;
}

/**
 * mealsByDay: date key -> number of distinct meals with entries.
 * Today never breaks a streak while it is still in progress.
 */
export function streakInfo(mealsByDay: Record<string, number>, today: string) {
  const counted = (k: string) => dayCounts(mealsByDay[k] ?? 0);
  let cur = 0;
  let k = counted(today) ? today : shiftDate(today, -1);
  while (counted(k)) { cur++; k = shiftDate(k, -1); }
  let best = 0, run = 0, prev: string | null = null;
  for (const key of Object.keys(mealsByDay).filter(counted).sort()) {
    run = prev && shiftDate(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return { current: cur, best: Math.max(best, cur), todayCounted: counted(today), mealsToday: mealsByDay[today] ?? 0 };
}

export const BADGES = [
  { id: 'starter', days: 3, name: 'Starter', blurb: '3 days in a row' },
  { id: 'week-warrior', days: 7, name: 'Week warrior', blurb: '7 days in a row' },
  { id: 'fortnight-force', days: 14, name: 'Fortnight force', blurb: '14 days in a row' },
  { id: 'thirty-club', days: 30, name: '30-day club', blurb: '30 days in a row' },
] as const;
export type BadgeId = (typeof BADGES)[number]['id'];

export function earnedBadges(best: number): BadgeId[] {
  return BADGES.filter(b => best >= b.days).map(b => b.id);
}

// ---------- Workouts: calories burned ----------
// MET values from the Compendium of Physical Activities (adult). Burn is NET of rest: (MET − 1) × kg × hours,
// because the base calorie target already covers resting energy. Estimates, not measurements.
export const WORKOUT_PRESETS = [
  { kind: 'hiit', label: 'HIIT class', met: 8, icon: 'bolt' },
  { kind: 'strength', label: 'Strength training', met: 5, icon: 'cube' },
  { kind: 'run', label: 'Running', met: 9.8, icon: 'arrow' },
  { kind: 'walk', label: 'Brisk walk', met: 4.3, icon: 'sun' },
  { kind: 'cycle', label: 'Cycling', met: 7, icon: 'plate' },
  { kind: 'yoga', label: 'Yoga', met: 3, icon: 'leaf' },
  { kind: 'dance', label: 'Dance fitness', met: 6, icon: 'heart' },
  { kind: 'boxing', label: 'Boxing class', met: 7.5, icon: 'flame' },
  { kind: 'swim', label: 'Swimming', met: 6, icon: 'drop' },
  { kind: 'sport', label: 'Sport (badminton, cricket…)', met: 5.5, icon: 'star' },
] as const;
export type WorkoutKind = (typeof WORKOUT_PRESETS)[number]['kind'];

export function estimateBurn(met: number, weightKg: number, minutes: number): number {
  if (!(met > 1) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return Math.round(((met - 1) * weightKg * minutes) / 60);
}

/** Share of logged burn added to the day's calorie target. Half, to absorb the error in wearable and MET estimates. */
export const EXERCISE_CREDIT = 0.5;
export function exerciseCredit(burnedKcal: number): number {
  return Math.max(0, Math.round(burnedKcal * EXERCISE_CREDIT));
}

// ---------- Recipes ----------

/** One ingredient: a catalogue food and how many of its servings the whole recipe uses. */
export type RecipeIngredient = { foodId: string; q: number };

export type RecipeNutrition = {
  /** For the whole recipe and for one serving. */
  total: Macros;
  perServing: Macros;
  /** Strictest diet of the ingredients (any chicken makes it non-veg). */
  diet: Diet;
  /** Ingredient food ids no longer in the catalogue; they add nothing. */
  missing: string[];
};

/** veg < egg < nonveg: how much a diet allows. */
export const DIET_RANK: Record<Diet, number> = { veg: 0, egg: 1, nonveg: 2 };

/** Recipe nutrition is always computed: ingredients × quantity, then ÷ servings. Never typed in. */
export function recipeNutrition(ingredients: RecipeIngredient[], servings: number, foodsById: Map<string, Food>): RecipeNutrition {
  const missing: string[] = [];
  let diet: Diet = 'veg';
  const total = ingredients.reduce<Macros>((acc, i) => {
    const f = foodsById.get(i.foodId);
    if (!f) { missing.push(i.foodId); return acc; }
    if (DIET_RANK[f.diet] > DIET_RANK[diet]) diet = f.diet;
    const n = nutrition(f, i.q);
    return { kcal: acc.kcal + n.kcal, p: acc.p + n.p, c: acc.c + n.c, f: acc.f + n.f, fibre: acc.fibre + n.fibre };
  }, { kcal: 0, p: 0, c: 0, f: 0, fibre: 0 });
  const per = Math.max(1, Math.round(servings) || 1);
  const div = (m: Macros): Macros => ({ kcal: round1(m.kcal / per), p: round1(m.p / per), c: round1(m.c / per), f: round1(m.f / per), fibre: round1(m.fibre / per) });
  const r = (m: Macros): Macros => ({ kcal: round1(m.kcal), p: round1(m.p), c: round1(m.c), f: round1(m.f), fibre: round1(m.fibre) });
  return { total: r(total), perServing: div(total), diet, missing };
}
