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

describe('mealCandidates with cuisine preferences', () => {
  const paneer = SEED_FOODS.find(f => f.id === 'paneer')!;
  const egg = SEED_FOODS.find(f => f.id === 'egg')!;
  // A few non-Indian foods built from real seed rows, so nutrition and diet stay realistic.
  const italian = [
    { ...paneer, id: 'caprese', name: 'Caprese salad', cuisine: 'Italian' },
    { ...egg, id: 'frittata', name: 'Frittata', cuisine: 'Italian' },
  ];
  const foods = [...SEED_FOODS, ...italian];
  const order = (set: ReturnType<typeof mealCandidates>) => set.candidates.map(c => c.food.id);

  it('open to all: every food neutral, catalogue order, no preferred cuisines', () => {
    const set = mealCandidates(foods, { diet: 'nonveg', restrictions: [], cuisines: { mode: 'open', chosen: ['Italian'] } });
    expect(set.candidates.every(c => c.weight === 1)).toBe(true);
    expect(order(set)).toEqual(foods.map(f => f.id));
    expect(set.preferred).toEqual([]);
    expect(set.thin).toBe(false);
  });

  it('mostly familiar: Indian foods first, others kept after them', () => {
    const set = mealCandidates(foods, { diet: 'nonveg', restrictions: [], cuisines: { mode: 'familiar', chosen: [] } });
    expect(set.preferred).toEqual(['Indian']);
    expect(order(set).slice(-2)).toEqual(['caprese', 'frittata']);
    expect(set.candidates.length).toBe(foods.length);
    expect(set.thin).toBe(false);
  });

  it('chosen cuisines: matching foods come first with a higher weight, the rest keep catalogue order', () => {
    const set = mealCandidates(foods, { diet: 'nonveg', restrictions: [], cuisines: { mode: 'chosen', chosen: ['italian'] } });
    expect(order(set).slice(0, 2)).toEqual(['caprese', 'frittata']);
    expect(set.candidates[0].weight).toBeGreaterThan(set.candidates[2].weight);
    expect(order(set).slice(2)).toEqual(SEED_FOODS.map(f => f.id));
  });

  it('falls back to the whole catalogue when chosen cuisines have too few foods', () => {
    const set = mealCandidates(foods, { diet: 'nonveg', restrictions: [], cuisines: { mode: 'chosen', chosen: ['Italian', 'Thai'] } });
    expect(set.thin).toBe(true);
    expect(set.candidates.length).toBe(foods.length);
    const none = mealCandidates(SEED_FOODS, { diet: 'veg', restrictions: [], cuisines: { mode: 'chosen', chosen: ['Korean'] } });
    expect(none.thin).toBe(true);
    expect(none.candidates.length).toBeGreaterThan(0);
  });

  it('diet and restrictions still win over a preferred cuisine', () => {
    const set = mealCandidates(foods, { diet: 'veg', restrictions: ['lactose-free'], request: 'no egg', cuisines: { mode: 'chosen', chosen: ['Italian'] } });
    expect(set.eligible.has('frittata')).toBe(false); // egg-based: diet says veg
    expect(set.eligible.has('caprese')).toBe(false); // paneer-based: lactose-free
    expect(set.thin).toBe(true);
  });
});

describe('candidateLines', () => {
  it('writes one id|name|unit|kcal|protein|cuisine line per candidate', () => {
    const set = mealCandidates(SEED_FOODS, { diet: 'veg', restrictions: [] });
    const lines = candidateLines(set).split('\n');
    expect(lines).toHaveLength(set.candidates.length);
    expect(lines[0].split('|')).toHaveLength(6);
    expect(lines[0].startsWith(`${set.candidates[0].food.id}|`)).toBe(true);
  });

  it('labels foods without a cuisine as Indian, and keeps a set cuisine', () => {
    const [first] = SEED_FOODS;
    const set = mealCandidates([first, { ...first, id: 'pesto-pasta', name: 'Pesto pasta', cuisine: 'Italian' }], { diet: 'nonveg', restrictions: [] });
    expect(candidateLines(set).split('\n').map(l => l.split('|').pop())).toEqual(['Indian', 'Italian']);
  });
});
