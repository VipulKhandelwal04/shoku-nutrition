import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../seed-foods';
import { candidateLines, mealCandidates } from './candidates';

const ids = (rules: Parameters<typeof mealCandidates>[1]) => new Set(mealCandidates(SEED_FOODS, rules).candidates.map(c => c.food.id));

describe('mealCandidates', () => {
  it('keeps only foods the diet allows', () => {
    const veg = ids({ diet: 'veg', restrictions: [] });
    expect(veg.has('paneer')).toBe(true);
    expect(veg.has('egg')).toBe(false);
    expect(veg.has('chicken')).toBe(false);

    const egg = ids({ diet: 'egg', restrictions: [] });
    expect(egg.has('egg')).toBe(true);
    expect(egg.has('chicken')).toBe(false);

    expect(ids({ diet: 'nonveg', restrictions: [] }).size).toBe(SEED_FOODS.length);
  });

  it('treats saved restrictions as hard rules', () => {
    const nuts = ids({ diet: 'veg', restrictions: ['nut allergy'] });
    expect(nuts.has('peanuts')).toBe(false);
    expect(nuts.has('peanut-butter')).toBe(false);
    expect(nuts.has('paneer')).toBe(true);
  });

  it('turns a clearly negative request into an exclusion, and ignores wishes', () => {
    const noPaneer = ids({ diet: 'veg', restrictions: [], request: 'veg dinner after leg day, no paneer' });
    expect(noPaneer.has('paneer')).toBe(false);
    expect(noPaneer.has('paneer-bhurji')).toBe(false);
    expect(noPaneer.has('curd')).toBe(true);

    const wish = ids({ diet: 'veg', restrictions: [], request: 'more paneer please' });
    expect(wish.has('paneer')).toBe(true);
  });

  it('gives every candidate a weight and an eligible lookup that matches the list', () => {
    const set = mealCandidates(SEED_FOODS, { diet: 'egg', restrictions: [] });
    expect(set.candidates.every(c => c.weight === 1)).toBe(true);
    expect([...set.eligible.keys()]).toEqual(set.candidates.map(c => c.food.id));
  });

  it('keeps catalogue order, so prompts stay stable', () => {
    const set = mealCandidates(SEED_FOODS, { diet: 'nonveg', restrictions: [] });
    expect(set.candidates.map(c => c.food.id)).toEqual(SEED_FOODS.map(f => f.id));
  });
});

describe('candidateLines', () => {
  it('writes one id|name|unit|kcal|protein line per candidate', () => {
    const set = mealCandidates(SEED_FOODS, { diet: 'veg', restrictions: [] });
    const lines = candidateLines(set).split('\n');
    expect(lines).toHaveLength(set.candidates.length);
    expect(lines[0].split('|')).toHaveLength(5);
    expect(lines[0].startsWith(`${set.candidates[0].food.id}|`)).toBe(true);
  });
});
