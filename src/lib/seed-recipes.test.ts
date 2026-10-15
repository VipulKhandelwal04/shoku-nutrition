import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recipeSchema } from './admin/schemas';
import { mealCandidates } from './ai/candidates';
import { recipeNutrition } from './nutrition';
import { SEED_FOODS } from './seed-foods';
import { SEED_RECIPES } from './seed-recipes';

const byId = new Map(SEED_FOODS.map(f => [f.id, f]));
const asRecipe = (r: (typeof SEED_RECIPES)[number], n: number) => ({ ...r, id: String(n) });

describe('first recipes (#14)', () => {
  it('has 20 to 30 recipes across at least three cuisines, each name unique', () => {
    expect(SEED_RECIPES.length).toBeGreaterThanOrEqual(20);
    expect(SEED_RECIPES.length).toBeLessThanOrEqual(30);
    expect(new Set(SEED_RECIPES.map(r => r.cuisine)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(SEED_RECIPES.map(r => r.name.toLowerCase())).size).toBe(SEED_RECIPES.length);
  });

  it('every recipe passes the admin schema and uses only catalogue foods', () => {
    for (const r of SEED_RECIPES) {
      expect(recipeSchema.safeParse({ ...r, active: true }).success, r.name).toBe(true);
      for (const i of r.ingredients) expect(byId.has(i.foodId), `${r.name}: ${i.foodId}`).toBe(true);
      expect(recipeNutrition(r.ingredients, r.servings, byId).missing).toEqual([]);
    }
  });

  it('a serving is a realistic meal or snack: 100 to 900 kcal', () => {
    for (const r of SEED_RECIPES) {
      const kcal = recipeNutrition(r.ingredients, r.servings, byId).perServing.kcal;
      expect(kcal, r.name).toBeGreaterThanOrEqual(100);
      expect(kcal, r.name).toBeLessThanOrEqual(900);
    }
  });

  it('every diet gets plenty: each recipe fits at least one diet, and veg members have most of them', () => {
    const fit = (diet: 'veg' | 'egg' | 'nonveg') => mealCandidates(SEED_FOODS, { diet, restrictions: [], recipes: SEED_RECIPES.map(asRecipe) }).recipes.length;
    expect(fit('nonveg')).toBe(SEED_RECIPES.length);
    expect(fit('veg')).toBeGreaterThanOrEqual(15);
    expect(fit('egg')).toBeGreaterThan(fit('veg'));
  });

  it('the seed migration is generated from this file (run npm run seed:recipes after editing)', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20261015000016_first_recipes.sql', import.meta.url), 'utf8');
    for (const r of SEED_RECIPES) expect(sql).toContain(`'${r.name.replaceAll("'", "''")}'`);
  });
});
