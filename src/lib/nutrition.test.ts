import { describe, expect, it } from 'vitest';
import { buildPlan, earnedBadges, groupStatus, MEALS, planCheck, recommend, shiftDate, streakInfo, totals, type Food } from './nutrition';
import { SEED_FOODS } from './seed-foods';

const byId = new Map<string, Food>(SEED_FOODS.map(f => [f.id, f]));
const food = (id: string) => byId.get(id)!;
const planKcal = (plan: ReturnType<typeof buildPlan>) => MEALS.flatMap(m => plan[m]).reduce((n, i) => n + food(i.foodId).kcal * i.q, 0);

describe('recommend', () => {
  it('matches the sample profile from the prototype', () => {
    const r = recommend({ goal: 'fit', sex: 'female', age: 29, height: 162, weight: 60, activity: 'moderate' });
    expect(r.kcal).toBe(2030);
    expect(r.p).toBe(76);
  });
  it('never drops a weight-loss target below 1,200 kcal', () => {
    expect(recommend({ goal: 'lose', sex: 'female', age: 40, height: 150, weight: 45, activity: 'sedentary' }).kcal).toBe(1200);
  });
});

describe('buildPlan', () => {
  it('lands within 5% of a very low target', () => {
    const plan = buildPlan({ kcal: 1200 }, 'lose', 'veg', byId);
    expect(planKcal(plan)).toBeLessThanOrEqual(1260);
  });
  it('keeps a vegetarian plan free of egg and meat', () => {
    const plan = buildPlan({ kcal: 2000 }, 'fit', 'veg', byId);
    expect(MEALS.flatMap(m => plan[m]).every(i => food(i.foodId).diet === 'veg')).toBe(true);
  });
  it('adds whey for muscle goals', () => {
    expect(buildPlan({ kcal: 2600 }, 'muscle', 'veg', byId).Snacks.some(i => i.foodId === 'whey')).toBe(true);
  });
});

describe('planCheck', () => {
  it('marks a planned food done once 80% is eaten and lists extras', () => {
    const plan = buildPlan({ kcal: 2000 }, 'fit', 'veg', byId);
    const oatsQ = plan.Breakfast.find(i => i.foodId === 'oats')!.q;
    const res = planCheck(plan, [
      { meal: 'Breakfast', quantity: oatsQ, food: food('oats') },
      { meal: 'Breakfast', quantity: 1, food: food('chai') },
    ], byId);
    const breakfast = res.rows.find(r => r.meal === 'Breakfast')!;
    expect(breakfast.items.find(i => i.foodId === 'oats')!.status).toBe('done');
    expect(breakfast.extras.map(e => e.food.id)).toEqual(['chai']);
  });
});

describe('groupStatus', () => {
  it('says so-far, never low, while the day is open', () => {
    const s = groupStatus([{ food: food('banana'), quantity: 0.2 }], 2000, true);
    expect(s.find(g => g.key === 'fruit')!.status).toBe('so-far');
    expect(groupStatus([{ food: food('banana'), quantity: 0.2 }], 2000, false).find(g => g.key === 'fruit')!.status).toBe('low');
  });
  it('flags limits only when exceeded', () => {
    expect(groupStatus([{ food: food('oil'), quantity: 10 }], 2000, true).find(g => g.key === 'oil')!.status).toBe('over');
  });
});

describe('streakInfo', () => {
  const today = '2026-10-15';
  it('counts days with 3+ meals and does not break on an unfinished today', () => {
    const days: Record<string, number> = {};
    for (let i = 1; i <= 6; i++) days[shiftDate(today, -i)] = 3;
    days[today] = 1;
    expect(streakInfo(days, today)).toMatchObject({ current: 6, todayCounted: false, mealsToday: 1 });
    days[today] = 3;
    expect(streakInfo(days, today).current).toBe(7);
  });
  it('remembers the best run after a gap', () => {
    const days = { '2026-10-01': 4, '2026-10-02': 3, '2026-10-03': 3, '2026-10-14': 3 };
    expect(streakInfo(days, today)).toMatchObject({ current: 1, best: 3 });
    expect(earnedBadges(3)).toEqual(['starter']);
  });
});

describe('totals', () => {
  it('sums macros by quantity', () => {
    expect(totals([{ food: food('chapati'), quantity: 2 }]).kcal).toBe(208);
  });
});

describe('workouts', () => {
  it('estimates net burn from MET, weight and minutes', async () => {
    const { estimateBurn } = await import('./nutrition');
    // (8 − 1) × 70 kg × 45/60 h = 367.5 → 368
    expect(estimateBurn(8, 70, 45)).toBe(368);
    expect(estimateBurn(1, 70, 60)).toBe(0);
    expect(estimateBurn(8, 0, 60)).toBe(0);
    expect(estimateBurn(8, 70, 0)).toBe(0);
  });
  it('credits half of the burn to the target, never negative', async () => {
    const { exerciseCredit } = await import('./nutrition');
    expect(exerciseCredit(360)).toBe(180);
    expect(exerciseCredit(0)).toBe(0);
    expect(exerciseCredit(-50)).toBe(0);
  });
});
