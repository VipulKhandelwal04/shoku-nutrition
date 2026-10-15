import { describe, expect, it } from 'vitest';
import { foodFits } from './restrictions';
import { SEED_FOODS } from './seed-foods';

const byId = new Map(SEED_FOODS.map(f => [f.id, f]));
const food = (id: string) => byId.get(id)!;

describe('diet and restrictions', () => {
  it('respects food style', () => {
    expect(foodFits(food('chicken'), 'veg', [])).toBe(false);
    expect(foodFits(food('egg'), 'egg', [])).toBe(true);
    expect(foodFits(food('chicken'), 'egg', [])).toBe(false);
    expect(foodFits(food('chicken'), 'nonveg', [])).toBe(true);
  });
  it('screens restrictions by keyword and food group', () => {
    expect(foodFits(food('paratha'), 'veg', ['jain'])).toBe(false); // aloo
    expect(foodFits(food('egg'), 'nonveg', ['jain'])).toBe(false); // jain is veg
    expect(foodFits(food('curd'), 'veg', ['lactose-free'])).toBe(false);
    expect(foodFits(food('chai'), 'veg', ['lactose-free'])).toBe(false);
    expect(foodFits(food('almonds'), 'veg', ['nut-allergy'])).toBe(false);
    expect(foodFits(food('chapati'), 'veg', ['gluten-free'])).toBe(false);
    expect(foodFits(food('rice'), 'veg', ['gluten-free'])).toBe(true);
    expect(foodFits(food('chai'), 'veg', ['diabetic-friendly'])).toBe(false); // sweetened
    expect(foodFits(food('dal'), 'veg', ['jain', 'gluten-free', 'diabetic-friendly'])).toBe(true);
  });
});
