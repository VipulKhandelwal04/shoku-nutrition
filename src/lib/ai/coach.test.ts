import { describe, expect, it } from 'vitest';
import type { Food } from '../nutrition';
import { SEED_FOODS } from '../seed-foods';
import { COACH_MAX, coachSummary, fallbackLine, isUnsafeLine, tidyLine } from './coach';

const food = (id: string) => SEED_FOODS.find(f => f.id === id) as Food;
const targets = { kcal: 2000, p: 80, c: 250, f: 65, water: 2500 };

describe('coachSummary', () => {
  it('summarises meals, totals and groups without shaming an open day', () => {
    const s = coachSummary([{ meal: 'Breakfast', food: food('oats'), quantity: 1 }, { meal: 'Lunch', food: food('dal'), quantity: 1 }], targets, true);
    expect(s.mealsLogged).toEqual(['Breakfast', 'Lunch']);
    expect(s.mealsMissing).toEqual(['Snacks', 'Dinner']);
    expect(s.kcal).toEqual({ eaten: 334, target: 2000 });
    expect(s.groups.some(g => g.status === 'low')).toBe(false);
  });
});

describe('tidyLine', () => {
  it('strips quotes and line breaks', () => {
    expect(tidyLine('"Great start!\nDal is in."')).toBe('Great start! Dal is in.');
  });
  it('cuts at a word boundary within the limit', () => {
    const out = tidyLine('Protein is building nicely '.repeat(8));
    expect(out.length).toBeLessThanOrEqual(COACH_MAX);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/ …$/);
  });
});

describe('isUnsafeLine', () => {
  it('flags medical and shaming words', () => {
    expect(isUnsafeLine('Fibre helps manage diabetes')).toBe(true);
    expect(isUnsafeLine('That was a bad choice')).toBe(true);
    expect(isUnsafeLine('Dal and curd at lunch: protein is stacking up. Add a fruit at snacks!')).toBe(false);
  });
});

describe('fallbackLine', () => {
  it('nudges the next meal while the day is open', () => {
    expect(fallbackLine({ mealsLogged: ['Breakfast'], mealsMissing: ['Lunch', 'Snacks', 'Dinner'], dayOpen: true })).toContain('lunch is next');
    expect(fallbackLine({ mealsLogged: [], mealsMissing: [], dayOpen: true })).toMatch(/first meal/);
  });
});
