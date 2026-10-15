// Request/response shapes for /api/ai/* (safe to import from client components) and the model output schemas.
import { z } from 'zod';
import { MEALS, type Meal, type Plan } from '../nutrition';
import type { AiSuggestion } from './match';

export type { AiSuggestion } from './match';
export type AiApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date');
export const MEAL = z.enum(MEALS);
export const MAX_TEXT = 300;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** POST /api/ai/photo (multipart: image, meal, day) and /api/ai/parse ({ text, meal, day }). */
export type SuggestResponse = { items: AiSuggestion[]; note: string | null; meal: Meal; day: string };

export const parseRequest = z.object({
  text: z.string().trim().min(2, 'Tell us what you ate').max(MAX_TEXT, `Keep it under ${MAX_TEXT} characters`),
  meal: MEAL,
  day: DAY,
});

/** POST /api/ai/plan ({ preferences }). Nothing is saved until the user confirms (saveAiPlan). */
export type PlanRow = { foodId: string; name: string; unit: string; icon: string; q: number; kcal: number };
export type PlanResponse = { plan: Plan; rows: Record<Meal, PlanRow[]>; kcal: number; target: number; note: string | null };
export const planRequest = z.object({ preferences: z.string().trim().max(MAX_TEXT, `Keep it under ${MAX_TEXT} characters`).default('') });

/** POST /api/ai/coach ({ day }). `ai` is false for the built-in line used on empty days (no AI call made). */
export type CoachResponse = { line: string; ai: boolean };
export const coachRequest = z.object({ day: DAY });

// ---------- What the model must return ----------

export const suggestionOutput = z.object({
  items: z.array(z.object({
    foodId: z.string().nullable().describe('Catalogue id from the list, or null when nothing fits'),
    name: z.string().describe('Short name of the food as seen or said, e.g. "roti"'),
    servings: z.number().describe('Servings in the catalogue unit of that food'),
    confidence: z.number().describe('0 to 1: how sure you are about this food and portion'),
  })).max(15),
  note: z.string().describe('One short neutral sentence about the estimate, or empty'),
});

const planMeal = z.array(z.object({ foodId: z.string(), servings: z.number() })).max(8);
export const planOutput = z.object({
  meals: z.object({ Breakfast: planMeal, Lunch: planMeal, Snacks: planMeal, Dinner: planMeal }),
  note: z.string().describe('One short sentence on how the plan reflects the preferences'),
});

export const coachOutput = z.object({ line: z.string() });
