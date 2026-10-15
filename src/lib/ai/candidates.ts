// Meal candidates: the one place that decides which catalogue foods a suggestion may use, and how strongly to
// prefer each. Every suggestion surface (Ask Shoku, Tune my plan, and later Plan my week and recipes) asks here,
// so diet and restriction rules can't drift between features. Pure; safe to test with the seed catalogue.
import { DEFAULT_CUISINE, cuisineOf, type Diet, type Food } from '../nutrition';
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
};

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
};

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
