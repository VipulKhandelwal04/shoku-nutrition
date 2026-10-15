'use server';
// Logging a recipe (#15): the server loads the recipe, re-checks it against the member's diet and restrictions,
// scales its ingredients to the servings chosen and logs them through the one diary path (addEntries), so Undo works.
import { z } from 'zod';
import { mealCandidates, recipeItems } from '../ai/candidates';
import { FLAG_OFF, isOn } from '../flags';
import { MEALS } from '../nutrition';
import { createClient } from '../supabase/server';
import type { Profile } from '../types';
import { addEntries, type ActionResult } from './diary';
import { getActiveRecipes, getFlags, getFoods } from './queries';

const schema = z.object({
  recipeId: z.string().uuid(),
  servings: z.number().positive().max(20),
  meal: z.enum(MEALS),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['plan', 'text_ai']).default('plan'),
});

export async function logRecipe(input: z.input<typeof schema>): Promise<ActionResult<{ ids: string[]; newBadges: string[] }>> {
  if (!isOn(await getFlags(), 'recipes', 'log')) return { ok: false, error: FLAG_OFF };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Pick how many servings to log.' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle<Profile>();
  if (!profile) return { ok: false, error: 'Your session ended. Sign in again.' };

  const set = mealCandidates(await getFoods(), { diet: profile.diet, restrictions: profile.restrictions ?? [], recipes: await getActiveRecipes() });
  const recipe = set.recipes.find(r => r.id === parsed.data.recipeId);
  if (!recipe) return { ok: false, error: 'That recipe isn’t available for your food style.' };
  const items = recipeItems(recipe, parsed.data.servings);
  return addEntries({ day: parsed.data.day, items: items.map(i => ({ meal: parsed.data.meal, foodId: i.foodId, quantity: i.quantity, source: parsed.data.source })) });
}
