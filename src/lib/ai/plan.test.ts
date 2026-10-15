import { describe, expect, it } from 'vitest';
import { MEALS, buildPlan, type Food } from '../nutrition';
import { SEED_FOODS } from '../seed-foods';
import {
  PLAN_TOLERANCE, TRAINING_DAY_BOOST, buildWeek, dayTarget, dietAllows, fitDay, isExcluded, isoWeekday, keepEligible, parseExclusions, parseStoredPlan,
  planForDay, planKcal, planRows, repairPlan, repairWeek, swapKey, swapMeal, toProposal, usualTrainingDays, type ProposedPlan,
} from './plan';

const byId = new Map<string, Food>(SEED_FOODS.map(f => [f.id, f]));
const food = (id: string) => byId.get(id)!;
const all = () => true;

const proposal = (): ProposedPlan => ({
  Breakfast: [{ foodId: 'oats', servings: 1 }, { foodId: 'milk', servings: 1 }, { foodId: 'banana', servings: 1 }],
  Lunch: [{ foodId: 'chapati', servings: 2 }, { foodId: 'dal', servings: 1 }, { foodId: 'sabzi', servings: 1 }, { foodId: 'curd', servings: 1 }],
  Snacks: [{ foodId: 'sprouts', servings: 1 }, { foodId: 'apple', servings: 1 }],
  Dinner: [{ foodId: 'chapati', servings: 2 }, { foodId: 'paneer-bhurji', servings: 1 }, { foodId: 'salad', servings: 1 }],
});

describe('dietAllows', () => {
  it('follows veg < egg < nonveg', () => {
    expect(dietAllows('veg', 'egg')).toBe(false);
    expect(dietAllows('egg', 'egg')).toBe(true);
    expect(dietAllows('egg', 'nonveg')).toBe(false);
    expect(dietAllows('nonveg', 'nonveg')).toBe(true);
  });
});

describe('parseExclusions / isExcluded', () => {
  it('reads "no X" from free-text preferences', () => {
    const ex = parseExclusions([], 'no paneer, more South Indian');
    expect(isExcluded(food('paneer'), ex)).toBe(true);
    expect(isExcluded(food('paneer-bhurji'), ex)).toBe(true);
    expect(isExcluded(food('idli'), ex)).toBe(false);
  });
  it('stops a "no" phrase at the next wish', () => {
    const ex = parseExclusions([], 'no rice more protein');
    expect(ex.terms).toEqual([['rice']]);
  });
  it('treats jain as no meat, egg, potato or onion', () => {
    const ex = parseExclusions(['jain'], '');
    expect(isExcluded(food('chicken'), ex)).toBe(true);
    expect(isExcluded(food('egg'), ex)).toBe(true);
    expect(isExcluded(food('paratha'), ex)).toBe(true); // aloo paratha
    expect(isExcluded(food('dal'), ex)).toBe(false);
  });
  it('handles dairy-free and nut allergy tags', () => {
    const ex = parseExclusions(['dairy-free', 'nut allergy'], '');
    expect(isExcluded(food('curd'), ex)).toBe(true);
    expect(isExcluded(food('whey'), ex)).toBe(true);
    expect(isExcluded(food('almonds'), ex)).toBe(true);
    expect(isExcluded(food('peanuts'), ex)).toBe(true);
    expect(isExcluded(food('rice'), ex)).toBe(false);
  });
  it('treats a plain profile restriction as a food to avoid', () => {
    const ex = parseExclusions(['mushroom', 'no-onion'], '');
    expect(ex.terms).toEqual([['mushroom'], ['onion']]);
  });
  it('ignores positive wishes', () => {
    const ex = parseExclusions([], 'more South Indian, high protein');
    expect(ex.terms).toEqual([]);
    expect(SEED_FOODS.some(f => isExcluded(f, ex))).toBe(false);
  });
});

describe('repairPlan', () => {
  it('keeps a plan already inside ±10% unchanged', () => {
    const p = proposal();
    const target = planKcal(Object.fromEntries(MEALS.map(m => [m, p[m].map(i => ({ foodId: i.foodId, q: i.servings, flex: false }))])) as never, byId);
    const r = repairPlan(p, { foodsById: byId, allowed: all, targetKcal: target });
    expect(r.ok && r.scaled).toBe(false);
    expect(r.ok && r.kcal).toBe(target);
  });
  it('drops unknown and disallowed foods, and merges duplicates', () => {
    const p = proposal();
    p.Lunch.push({ foodId: 'pizza', servings: 1 }, { foodId: 'chicken', servings: 1 }, { foodId: 'dal', servings: 0.5 });
    const r = repairPlan(p, { foodsById: byId, allowed: f => dietAllows('veg', f.diet), targetKcal: 1900 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dropped).toBe(2);
    expect(r.plan.Lunch.filter(i => i.foodId === 'dal')).toHaveLength(1);
    expect(MEALS.flatMap(m => r.plan[m]).every(i => food(i.foodId).diet === 'veg' && i.flex === false)).toBe(true);
  });
  it('scales portions into the ±10% window', () => {
    for (const target of [1400, 2600]) {
      const r = repairPlan(proposal(), { foodsById: byId, allowed: all, targetKcal: target });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.scaled).toBe(true);
      expect(r.kcal).toBeGreaterThanOrEqual(target * 0.9);
      expect(r.kcal).toBeLessThanOrEqual(target * 1.1);
      expect(MEALS.flatMap(m => r.plan[m]).every(i => i.q >= 0.25 && i.q <= 20 && Number.isInteger(i.q * 4))).toBe(true);
    }
  });
  it('rejects plans missing a main meal or wildly off target', () => {
    const p = proposal();
    p.Dinner = [{ foodId: 'pizza', servings: 1 }];
    expect(repairPlan(p, { foodsById: byId, allowed: all, targetKcal: 2000 }).ok).toBe(false);
    expect(repairPlan(proposal(), { foodsById: byId, allowed: all, targetKcal: 9000 }).ok).toBe(false);
  });
});

describe('buildWeek', () => {
  const target = { kcal: 2000 };
  const setup = (diet: 'veg' | 'egg' | 'nonveg') => {
    const eligible = SEED_FOODS.filter(f => dietAllows(diet, f.diet));
    const plan = buildPlan(target, 'fit', diet, new Map(eligible.map(f => [f.id, f])));
    return { eligible, plan, week: buildWeek(plan, { eligible, targetKcal: target.kcal }) };
  };

  it('builds seven days, each within the calorie tolerance', () => {
    for (const diet of ['veg', 'egg', 'nonveg'] as const) {
      const { week, eligible } = setup(diet);
      expect(week).toHaveLength(7);
      const byId = new Map(eligible.map(f => [f.id, f]));
      for (const d of week.slice(1)) {
        expect(Math.abs(planKcal(d.plan, byId) - target.kcal)).toBeLessThanOrEqual(target.kcal * PLAN_TOLERANCE);
        for (const m of ['Breakfast', 'Lunch', 'Dinner'] as const) expect(d.plan[m].length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps day one exactly the day plan, and leaves the day plan untouched', () => {
    const { plan, week } = setup('veg');
    const before = JSON.stringify(plan);
    expect(week[0].plan).toBe(plan);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('varies foods across the week', () => {
    const { week } = setup('veg');
    const lunches = new Set(week.map(d => d.plan.Lunch.map(i => i.foodId).sort().join(',')));
    expect(lunches.size).toBeGreaterThanOrEqual(3);
    expect(week.slice(1).every(d => d.rotated > 0)).toBe(true);
  });

  it('only swaps within the diet and within the same kind of food', () => {
    const { week, eligible } = setup('veg');
    const byId = new Map(SEED_FOODS.map(f => [f.id, f]));
    for (const d of week) for (const m of MEALS) for (const i of d.plan[m]) {
      expect(eligible.some(f => f.id === i.foodId)).toBe(true);
      expect(byId.get(i.foodId)!.diet).toBe('veg');
    }
    expect(swapKey(byId.get('chapati')!)).toBe(swapKey(byId.get('rice')!));
    expect(swapKey(byId.get('chapati')!)).not.toBe(swapKey(byId.get('dal')!));
    expect(swapKey(byId.get('whey')!)).toBeNull();
  });
});

describe('swapMeal and isoWeekday', () => {
  const eligible = SEED_FOODS.filter(f => dietAllows('veg', f.diet));
  const foodsById = new Map(eligible.map(f => [f.id, f]));
  const day = buildPlan({ kcal: 2000 }, 'fit', 'veg', foodsById);
  const within = (kcal: number) => Math.abs(kcal - 2000) <= 2000 * PLAN_TOLERANCE;

  it('applies the swap and keeps the day within the calorie tolerance', () => {
    const r = swapMeal(day, 'Lunch', [{ foodId: 'rice', q: 1, flex: true }, { foodId: 'rajma', q: 1, flex: true }], { eligible: foodsById, targetKcal: 2000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.Lunch.map(i => i.foodId)).toEqual(['rice', 'rajma']);
    expect(r.plan.Breakfast.map(i => i.foodId)).toEqual(day.Breakfast.map(i => i.foodId));
    expect(within(planKcal(r.plan, foodsById))).toBe(true);
  });

  it('rescales a swap that would push the day too high', () => {
    const r = swapMeal(day, 'Dinner', [{ foodId: 'paneer-bhurji', q: 4, flex: true }, { foodId: 'chapati', q: 5, flex: true }], { eligible: foodsById, targetKcal: 2000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(within(r.kcal)).toBe(true);
  });

  it('drops foods the member can’t have, and never changes the day passed in', () => {
    const before = JSON.stringify(day);
    const r = swapMeal(day, 'Dinner', [{ foodId: 'chicken', q: 1, flex: true }, { foodId: 'chapati', q: 2, flex: true }], { eligible: foodsById, targetKcal: 2000 });
    expect(r.ok && r.plan.Dinner.map(i => i.foodId)).toEqual(['chapati']);
    expect(JSON.stringify(day)).toBe(before);
  });

  it('fails when the swap empties a main meal', () => {
    expect(swapMeal(day, 'Lunch', [], { eligible: foodsById, targetKcal: 2000 }).ok).toBe(false);
  });

  it('numbers weekdays Monday 1 to Sunday 7', () => {
    expect(isoWeekday('2026-10-12')).toBe(1); // Monday
    expect(isoWeekday('2026-10-15')).toBe(4); // Thursday
    expect(isoWeekday('2026-10-18')).toBe(7); // Sunday
  });
});

describe('usualTrainingDays', () => {
  // 2026-10-15 is a Thursday. The window is the 28 days up to and including it.
  it('keeps weekdays with a workout in at least two of the last four weeks', () => {
    const days = ['2026-10-12', '2026-10-05', '2026-09-28', /* Mondays x3 */ '2026-10-14', /* one Wednesday */ '2026-10-11', '2026-10-04' /* Sundays x2 */];
    expect(usualTrainingDays(days, '2026-10-15')).toEqual([1, 7]);
  });
  it('counts a day once however many workouts it had, and ignores days outside the window', () => {
    expect(usualTrainingDays(['2026-10-13', '2026-10-13', '2026-10-13'], '2026-10-15')).toEqual([]);
    expect(usualTrainingDays(['2026-09-01', '2026-09-08', '2026-09-15'], '2026-10-15')).toEqual([]);
    expect(usualTrainingDays([], '2026-10-15')).toEqual([]);
  });
});

describe('repairWeek', () => {
  const eligible = SEED_FOODS.filter(f => dietAllows('veg', f.diet));
  const foodsById = new Map(eligible.map(f => [f.id, f]));
  const dayPlan = buildPlan({ kcal: 2000 }, 'fit', 'veg', foodsById);
  const asDay = (weekday: number, extra: Partial<ProposedPlan> = {}) => ({
    weekday,
    ...Object.fromEntries(MEALS.map(m => [m, dayPlan[m].map(i => ({ foodId: i.foodId, servings: i.q }))])),
    ...extra,
  });
  const opts = { eligible: foodsById, targetKcal: 2000, trainingDays: [2, 5], fallback: () => dayPlan };
  const within = (kcal: number, target: number) => Math.abs(kcal - target) <= target * PLAN_TOLERANCE;

  it('returns all seven weekdays, each within the tolerance of its own target', () => {
    const week = repairWeek([1, 2, 3, 4, 5, 6, 7].map(d => asDay(d)), opts);
    expect(week.map(d => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const d of week) expect(within(d.kcal, d.target)).toBe(true);
  });

  it('gives usual training days a higher target', () => {
    const week = repairWeek([1, 2, 3, 4, 5, 6, 7].map(d => asDay(d)), opts);
    const tue = week.find(d => d.weekday === 2)!, wed = week.find(d => d.weekday === 3)!;
    expect(tue.training).toBe(true);
    expect(tue.target).toBe(Math.round(2000 * (1 + TRAINING_DAY_BOOST)));
    expect(wed.target).toBe(2000);
    expect(tue.kcal).toBeGreaterThan(wed.kcal);
    expect(dayTarget(5, [2, 5], 2000)).toBe(2200);
  });

  it('drops ineligible foods and fixes silly portions', () => {
    const week = repairWeek([asDay(1, { Dinner: [{ foodId: 'chicken', servings: 2 }, { foodId: 'chapati', servings: 30 }, { foodId: 'dal', servings: 1 }] })], opts);
    const mon = week[0];
    expect(mon.fallback).toBe(false);
    expect(mon.plan.Dinner.map(i => i.foodId)).toEqual(['chapati', 'dal']);
    expect(mon.plan.Dinner.find(i => i.foodId === 'chapati')!.q).toBeLessThanOrEqual(20);
    expect(within(mon.kcal, mon.target)).toBe(true);
  });

  it('falls back for missing or unfixable days', () => {
    const week = repairWeek([asDay(1, { Lunch: [{ foodId: 'chicken', servings: 1 }] })], opts);
    expect(week[0].fallback).toBe(true); // lunch empty after dropping chicken
    expect(week[3].fallback).toBe(true); // Thursday never proposed
    expect(within(week[3].kcal, week[3].target)).toBe(true);
  });
});

describe('fitDay on training days', () => {
  const eligible = new Map(SEED_FOODS.filter(f => dietAllows('veg', f.diet)).map(f => [f.id, f]));
  const day = buildPlan({ kcal: 2000 }, 'fit', 'veg', eligible);
  const sum = (plan: ReturnType<typeof buildPlan>, k: 'p' | 'c' | 'f') => MEALS.flatMap(m => plan[m]).reduce((n, i) => n + eligible.get(i.foodId)![k] * i.q, 0);

  it('adds the boost as protein and carbs: fat grows less than calories do', () => {
    const rest = fitDay(toProposal(day), { eligible, targetKcal: 2000 });
    const train = fitDay(toProposal(day), { eligible, targetKcal: 2000, training: true });
    expect(rest.ok && train.ok).toBe(true);
    if (!rest.ok || !train.ok) return;
    expect(Math.abs(train.kcal - 2200)).toBeLessThanOrEqual(2200 * PLAN_TOLERANCE);
    const kcalGrowth = train.kcal / rest.kcal;
    expect(sum(train.plan, 'p') + sum(train.plan, 'c')).toBeGreaterThan(sum(rest.plan, 'p') + sum(rest.plan, 'c'));
    expect(sum(train.plan, 'f') / sum(rest.plan, 'f')).toBeLessThan(kcalGrowth);
    // Oil and nuts never take the boost.
    const almonds = (p: typeof day) => MEALS.flatMap(m => p[m]).find(i => i.foodId === 'almonds')?.q ?? 0;
    expect(almonds(train.plan)).toBeLessThanOrEqual(almonds(rest.plan));
  });

  it('buildWeek gives usual training days the boost and leaves day one as the plan on a rest day', () => {
    const week = buildWeek(day, { eligible: [...eligible.values()], targetKcal: 2000, trainingDays: [2], startWeekday: 1 });
    expect(week[0].plan).toBe(day);
    expect(week[1].training).toBe(true); // Tuesday
    expect(Math.abs(week[1].kcal - 2200)).toBeLessThanOrEqual(2200 * PLAN_TOLERANCE);
    expect(week[2].training).toBe(false);
  });
});

describe('repairWeek never returns a food the member can’t have', () => {
  it('drops excluded foods from a fallback day even when it can’t be fitted', () => {
    const eligible = new Map(SEED_FOODS.filter(f => f.id !== 'chapati' && dietAllows('veg', f.diet)).map(f => [f.id, f]));
    const all = new Map(SEED_FOODS.map(f => [f.id, f]));
    const fallback = buildPlan({ kcal: 2000 }, 'fit', 'veg', all); // still has chapati
    const week = repairWeek([], { eligible, targetKcal: 2000, trainingDays: [], fallback: () => fallback });
    for (const d of week) for (const m of MEALS) for (const i of d.plan[m]) expect(eligible.has(i.foodId)).toBe(true);
  });
});

describe('plan shapes', () => {
  const byId = new Map(SEED_FOODS.map(f => [f.id, f]));
  const plan = buildPlan({ kcal: 2000 }, 'fit', 'veg', byId);
  it('toProposal and keepEligible keep foods and quantities', () => {
    expect(toProposal(plan).Lunch).toEqual(plan.Lunch.map(i => ({ foodId: i.foodId, servings: i.q })));
    const noDal = keepEligible(plan, new Map([...byId].filter(([id]) => id !== 'dal')));
    expect(MEALS.flatMap(m => noDal[m]).some(i => i.foodId === 'dal')).toBe(false);
  });
  it('planRows names each item and skips unknown foods', () => {
    const rows = planRows({ ...plan, Lunch: [...plan.Lunch, { foodId: 'ghost', q: 1, flex: false }] }, byId);
    expect(rows.Lunch.map(r => r.foodId)).toEqual(plan.Lunch.map(i => i.foodId));
    expect(rows.Lunch[0]).toMatchObject({ name: byId.get(plan.Lunch[0].foodId)!.name, kcal: Math.round(byId.get(plan.Lunch[0].foodId)!.kcal * plan.Lunch[0].q) });
  });
  it('parseStoredPlan keeps valid items and drops unknown foods or bad quantities', () => {
    const p = parseStoredPlan({ Breakfast: [{ foodId: 'oats', q: 1, flex: true }, { foodId: 'ghost', q: 1 }], Lunch: [{ foodId: 'dal', q: -1 }], Dinner: 'x' }, byId);
    expect(p?.Breakfast).toEqual([{ foodId: 'oats', q: 1, flex: true }]);
    expect(p?.Lunch).toEqual([]);
    expect(parseStoredPlan(null, byId)).toBeNull();
    expect(parseStoredPlan({ Breakfast: [] }, byId)).toBeNull();
  });
});

describe('planForDay', () => {
  const eligible = new Map(SEED_FOODS.filter(f => dietAllows('veg', f.diet)).map(f => [f.id, f]));
  const day = buildPlan({ kcal: 2000 }, 'fit', 'veg', eligible);
  it('returns the plan untouched on a rest day and fuelled on a training day', () => {
    expect(planForDay(day, { eligible, targetKcal: 2000 })).toBe(day);
    const train = planForDay(day, { eligible, targetKcal: 2000, training: true });
    expect(Math.abs(planKcal(train, eligible) - 2200)).toBeLessThanOrEqual(2200 * PLAN_TOLERANCE);
  });
  it('buildWeek fuels day one when today is a usual training day, so the Training label means more food', () => {
    const week = buildWeek(day, { eligible: [...eligible.values()], targetKcal: 2000, trainingDays: [4], startWeekday: 4 });
    expect(week[0].training).toBe(true);
    expect(week[0].kcal).toBeGreaterThan(planKcal(day, eligible));
  });
});
