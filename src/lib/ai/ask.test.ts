import { describe, expect, it } from 'vitest';
import type { Food } from '../nutrition';
import { SEED_FOODS } from '../seed-foods';
import { nextMeal, repairIdeas, tidy } from './ask';

const byId = new Map<string, Food>(SEED_FOODS.map(f => [f.id, f]));
const only = (...ids: string[]) => new Map(ids.map(id => [id, byId.get(id)!]));

describe('nextMeal', () => {
  it('follows the clock', () => {
    expect(nextMeal(8, [])).toBe('Breakfast');
    expect(nextMeal(13, [])).toBe('Lunch');
    expect(nextMeal(16, [])).toBe('Snacks');
    expect(nextMeal(20, [])).toBe('Dinner');
  });
  it('skips a meal that is already logged', () => {
    expect(nextMeal(13, ['Lunch'])).toBe('Snacks');
  });
  it('stays on dinner late at night even when it is logged', () => {
    expect(nextMeal(23, ['Dinner'])).toBe('Dinner');
  });
});

describe('repairIdeas', () => {
  it('drops foods that are not eligible, and ideas left empty', () => {
    const out = repairIdeas([
      { title: 'A', meal: 'Dinner', why: 'x', items: [{ foodId: 'dal', servings: 1 }, { foodId: 'not-a-food', servings: 2 }] },
      { title: 'B', meal: 'Dinner', why: 'y', items: [{ foodId: 'not-a-food', servings: 1 }] },
    ], only('dal'));
    expect(out).toHaveLength(1);
    expect(out[0].items.map(i => i.foodId)).toEqual(['dal']);
  });

  it('rounds and clamps portions, merges repeats, and totals kcal and protein', () => {
    const [idea] = repairIdeas([
      { title: 'Roti plate', meal: 'Lunch', why: '', items: [{ foodId: 'chapati', servings: 1.1 }, { foodId: 'chapati', servings: 1 }, { foodId: 'dal', servings: 40 }] },
    ], only('chapati', 'dal'));
    const roti = idea.items.find(i => i.foodId === 'chapati')!;
    const dal = idea.items.find(i => i.foodId === 'dal')!;
    expect(roti.q).toBe(2);
    expect(dal.q).toBe(6);
    expect(idea.kcal).toBe(roti.kcal + dal.kcal);
    expect(idea.p).toBe(roti.p + dal.p);
  });

  it('never returns more than three ideas', () => {
    const raw = Array.from({ length: 5 }, (_, n) => ({ title: `I${n}`, meal: 'Snacks' as const, why: '', items: [{ foodId: 'banana', servings: 1 }] }));
    expect(repairIdeas(raw, only('banana'))).toHaveLength(3);
  });

  it('names an untitled idea after its foods', () => {
    const [idea] = repairIdeas([{ title: '  ', meal: 'Snacks', why: '', items: [{ foodId: 'banana', servings: 1 }] }], only('banana'));
    expect(idea.title).toContain(byId.get('banana')!.name);
  });
});

describe('tidy', () => {
  it('collapses whitespace and shortens on a word boundary', () => {
    expect(tidy('  a   b ', 10)).toBe('a b');
    expect(tidy('one two three four five six', 12).endsWith('…')).toBe(true);
  });
});
