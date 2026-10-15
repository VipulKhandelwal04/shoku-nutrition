// Meal candidates: the one place that decides which catalogue foods a suggestion may use, and how strongly to
// prefer each. Every suggestion surface (Ask Shoku, Tune my plan, and later Plan my week and recipes) asks here,
// so diet and restriction rules can't drift between features. Pure; safe to test with the seed catalogue.
import { cuisineOf, type Diet, type Food } from '../nutrition';
import { dietAllows, isExcluded, parseExclusions, type Exclusions } from './plan';

/** What a member's settings and request say about the foods they may be offered. */
export type CandidateRules = {
  diet: Diet;
  /** Saved profile restrictions (e.g. "jain", "nut allergy"). Always hard. */
  restrictions: string[];
  /** Free text from the request; only clearly negative phrases ("no paneer") become hard exclusions. */
  request?: string;
};

/** An eligible food and how strongly to prefer it (1 = neutral). Weights only ever reorder, never exclude. */
export type Candidate = { food: Food; weight: number };

export type CandidateSet = {
  candidates: Candidate[];
  /** Eligible foods by id, for validating and repairing model output. */
  eligible: Map<string, Food>;
  /** The hard exclusions applied, in case a caller needs to re-check something (e.g. a saved plan). */
  exclusions: Exclusions;
};

/**
 * Hard rules remove foods: diet, saved restrictions and "no X" in the request. Everything left is a candidate with
 * a neutral weight for now; cuisine and feedback preferences will adjust weights without removing anything.
 * Order follows the catalogue so prompts stay stable.
 */
export function mealCandidates(foods: Food[], rules: CandidateRules): CandidateSet {
  const exclusions = parseExclusions(rules.restrictions, rules.request ?? '');
  const candidates = foods
    .filter(f => dietAllows(rules.diet, f.diet) && !isExcluded(f, exclusions))
    .map(food => ({ food, weight: 1 }));
  return { candidates, eligible: new Map(candidates.map(c => [c.food.id, c.food])), exclusions };
}

/** Catalogue lines for prompts: id|name|unit|kcal per unit|protein g per unit|cuisine, in candidate order. */
export function candidateLines(set: Pick<CandidateSet, 'candidates'>): string {
  return set.candidates.map(({ food: f }) => [f.id, f.name, f.unit, Math.round(f.kcal), Math.round(f.p), cuisineOf(f)].join('|')).join('\n');
}
