// Meal candidates: the one place that decides which catalogue foods a suggestion may use, and how strongly to
// prefer each. Every suggestion surface (Ask Shoku, Tune my plan, and later Plan my week and recipes) asks here,
// so diet and restriction rules can't drift between features. Pure; safe to test with the seed catalogue.
import { DEFAULT_CUISINE, cuisineOf, recipeNutrition, type Diet, type Food, type Macros, type RecipeIngredient } from '../nutrition';
import type { CuisinePrefs } from '../preferences';
import type { FeedbackSummary } from './feedback';
import { dietAllows, isExcluded, parseExclusions, type Exclusions } from './plan';

/** What a member's settings and request say about the foods they may be offered. */
export type CandidateRules = {
  diet: Diet;
  /** Saved profile restrictions (e.g. "jain", "nut allergy"). Always hard. */
  restrictions: string[];
  /** Free text from the request; only clearly negative phrases ("no paneer") become hard exclusions. */
  request?: string;
  /** Cuisine preferences. Soft: they reorder, never remove. Missing = open to all. */
  cuisines?: CuisinePrefs;
  /** Meal feedback. Soft: liked foods rise, "not for me" sinks, nothing is removed. Missing = no feedback. */
  feedback?: FeedbackSummary;
  /** Active recipes. A recipe is a candidate only when every one of its ingredients is. */
  recipes?: Recipe[];
};

/** What the candidates module needs from a recipe. */
export type Recipe = { id: string; name: string; cuisine: string; servings: number; steps: string[]; ingredients: RecipeIngredient[] };

/** An eligible food and how strongly to prefer it (1 = neutral). Weights only ever reorder, never exclude. */
export type Candidate = { food: Food; weight: number };

export type CandidateSet = {
  candidates: Candidate[];
  /** Eligible foods by id, for validating and repairing model output. */
  eligible: Map<string, Food>;
  /** The hard exclusions applied, in case a caller needs to re-check something (e.g. a saved plan). */
  exclusions: Exclusions;
  /** Cuisines the member leans toward (empty when open to all). Shown in "What Shoku used". */
  preferred: string[];
  /** True when the preferred cuisines have too few eligible foods, so suggestions draw on the rest too. */
  thin: boolean;
  /** Eligible foods the member liked / rated "not for me", in candidate order. */
  liked: Food[];
  disliked: Food[];
  /** Recipes whose ingredients all passed the hard rules (diet, restrictions, "no X"). */
  recipes: Recipe[];
};

/** Cooking fat doesn't make a dish: ignored when matching a meal to a recipe, and only diet applies to it. */
const MINOR_INGREDIENTS = new Set(['oil']);

/** A preferred cuisine's foods get this weight; everything else stays at 1. */
export const PREFERRED_WEIGHT = 2;
/** Fewer preferred foods than this and the preference can't carry a meal on its own. */
export const THIN_CUISINE = 8;

/** Which cuisines a member leans toward. "Mostly familiar" means home-style Indian, the catalogue's home cuisine. */
function preferredCuisines(prefs: CuisinePrefs | undefined): string[] {
  if (!prefs || prefs.mode === 'open') return [];
  if (prefs.mode === 'familiar') return [DEFAULT_CUISINE];
  return [...new Set(prefs.chosen.map(c => c.trim()).filter(Boolean))];
}

/**
 * Hard rules remove foods: diet, saved restrictions and "no X" in the request. Everything left is a candidate.
 * Cuisine preferences and liked foods raise weight; "not for me" lowers it. Higher weight comes first in the
 * prompt; nothing is removed for cuisine or feedback.
 * Within the same weight, order follows the catalogue so prompts stay stable.
 */
export function mealCandidates(foods: Food[], rules: CandidateRules): CandidateSet {
  const exclusions = parseExclusions(rules.restrictions, rules.request ?? '');
  const preferred = preferredCuisines(rules.cuisines);
  const want = new Set(preferred.map(c => c.toLowerCase()));
  const candidates = foods
    .filter(f => dietAllows(rules.diet, f.diet) && !isExcluded(f, exclusions))
    .map(food => ({
      food,
      weight: (want.has(cuisineOf(food).toLowerCase()) ? PREFERRED_WEIGHT : 1) * (rules.feedback?.factor.get(food.id) ?? 1),
    }))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.weight - a.c.weight || a.i - b.i)
    .map(x => x.c);
  const isPreferred = (f: Food) => want.has(cuisineOf(f).toLowerCase());
  const preferredCount = candidates.filter(c => isPreferred(c.food)).length;
  const fb = (f: Food) => rules.feedback?.factor.get(f.id) ?? 1;
  return {
    candidates,
    eligible: new Map(candidates.map(c => [c.food.id, c.food])),
    exclusions,
    preferred,
    thin: preferred.length > 0 && preferredCount < THIN_CUISINE,
    liked: candidates.filter(c => fb(c.food) > 1).map(c => c.food),
    disliked: candidates.filter(c => fb(c.food) < 1).map(c => c.food),
    recipes: (rules.recipes ?? []).filter(r => r.ingredients.length > 0 && r.ingredients.every(i =>
      candidates.some(c => c.food.id === i.foodId)
      // Cooking oil only has to fit the diet: its "ghee" search alias would otherwise rule out every recipe for a
      // lactose-free member. Members cook with the fat that suits them; the main ingredients carry the rules.
      || (MINOR_INGREDIENTS.has(i.foodId) && foods.some(f => f.id === i.foodId && dietAllows(rules.diet, f.diet))))),
  };
}

/** Catalogue lines for prompts: id|name|unit|kcal per unit|protein g per unit|cuisine, in candidate order. */
export function candidateLines(set: Pick<CandidateSet, 'candidates'>): string {
  return set.candidates.map(({ food: f }) => [f.id, f.name, f.unit, Math.round(f.kcal), Math.round(f.p), cuisineOf(f)].join('|')).join('\n');
}

/** The feedback part of a prompt brief, or null when there is none. Names only: the model never sees notes. */
export function feedbackBrief(set: Pick<CandidateSet, 'liked' | 'disliked'>, feedback: FeedbackSummary | undefined) {
  if (!feedback?.any) return null;
  const names = (fs: Food[]) => fs.slice(0, 8).map(f => f.name);
  const brief = { likedFoods: names(set.liked), notForMe: names(set.disliked), likedMeals: feedback.likedMeals };
  return brief.likedFoods.length || brief.notForMe.length || brief.likedMeals.length ? brief : null;
}

/** The cuisine part of a prompt brief, or null when the member is open to all cuisines. */
export function cuisineBrief(set: Pick<CandidateSet, 'preferred' | 'thin'>): { prefer: string[]; fewMatches: boolean } | null {
  return set.preferred.length ? { prefer: set.preferred, fewMatches: set.thin } : null;
}

// ---------- Recipes as meals ----------

/** A meal matches a recipe when it has at least this share of the recipe's main ingredients (and at least two). */
export const RECIPE_MATCH = 0.6;

/** The recipe a meal (its food ids) is best described by, or null. Prefers the fullest, then the biggest overlap. */
export function matchRecipe<R extends Pick<Recipe, 'ingredients'>>(foodIds: string[], recipes: R[]): R | null {
  const have = new Set(foodIds);
  let best: { r: R; share: number; hits: number } | null = null;
  for (const r of recipes) {
    const main = r.ingredients.map(i => i.foodId).filter(id => !MINOR_INGREDIENTS.has(id));
    if (!main.length) continue;
    const hits = main.filter(id => have.has(id)).length;
    const share = hits / main.length;
    if (share < RECIPE_MATCH || hits < Math.min(2, main.length)) continue;
    if (!best || share > best.share || (share === best.share && hits > best.hits)) best = { r, share, hits };
  }
  return best?.r ?? null;
}

/** A recipe ready to show and log: ingredient names and units, nutrition per serving and its diet. */
export type RecipeCard = {
  id: string; name: string; cuisine: string; servings: number; steps: string[]; diet: Diet;
  /** Quantities for the whole recipe, in each food's own servings. */
  ingredients: { foodId: string; name: string; unit: string; icon: string; q: number }[];
  perServing: Macros;
};

export function recipeCard(r: Recipe, foodsById: Map<string, Food>): RecipeCard {
  const n = recipeNutrition(r.ingredients, r.servings, foodsById);
  return {
    id: r.id, name: r.name, cuisine: r.cuisine, servings: r.servings, steps: r.steps, diet: n.diet, perServing: n.perServing,
    ingredients: r.ingredients.flatMap(i => {
      const f = foodsById.get(i.foodId);
      return f ? [{ foodId: f.id, name: f.name, unit: f.unit, icon: f.icon, q: i.q }] : [];
    }),
  };
}

/** Diary items for logging `servings` of a recipe to a meal: each ingredient scaled from the whole recipe. */
export function recipeItems(r: Pick<Recipe, 'ingredients' | 'servings'>, servings: number): { foodId: string; quantity: number }[] {
  const k = servings / Math.max(1, r.servings);
  return r.ingredients
    .map(i => ({ foodId: i.foodId, quantity: Math.round(i.q * k * 100) / 100 }))
    .filter(i => i.quantity > 0);
}

/** Recipe lines for prompts: name|cuisine|ingredient ids, so the model can build an idea from a recipe. */
export function recipeLines(recipes: Recipe[]): string {
  return recipes.slice(0, 40).map(r => [r.name, r.cuisine, r.ingredients.map(i => i.foodId).join(' ')].join('|')).join('\n');
}
