import { describe, expect, it } from 'vitest';
import { MEALS, type Food } from '../nutrition';
import { SEED_FOODS } from '../seed-foods';
import { dietAllows, isExcluded, parseExclusions, planKcal, repairPlan, type ProposedPlan } from './plan';

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
