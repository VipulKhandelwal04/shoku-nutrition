// Request/response shapes for /api/ai/* (safe to import from client components) and the model output schemas.
import { z } from 'zod';
import { MEALS, type Meal, type Plan } from '../nutrition';
import type { AiSuggestion } from './match';
import type { RecipeCard } from './candidates';

export type { AiSuggestion } from './match';
export type AiApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date');
export const MEAL = z.enum(MEALS);
export const MAX_TEXT = 300;
/** A day plan as the client sends it back to be saved (Use this plan, a swapped week day, Use this week). */
const planItem = z.object({ foodId: z.string().min(1).max(80), q: z.number().min(0.25).max(20), flex: z.boolean().default(false) });
export const planSchema = z.object(Object.fromEntries(MEALS.map(m => [m, z.array(planItem).max(8)])) as Record<Meal, z.ZodArray<typeof planItem>>);

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
export type PlanResponse = { plan: Plan; rows: Record<Meal, PlanRow[]>; kcal: number; target: number; note: string | null; cuisines: string[]; feedback: boolean };
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

// ---------- Plan my week ----------

/** POST /api/ai/week ({ preferences }). Nothing is saved until the member confirms (saveAiWeek). */
export const weekRequest = z.object({ preferences: z.string().trim().max(MAX_TEXT, `Keep it under ${MAX_TEXT} characters`).default('') });
export type WeekDayResult = {
  weekday: number;
  /** "Mon", "Tue", … */
  label: string;
  training: boolean;
  kcal: number;
  target: number;
  plan: Plan;
  rows: Record<Meal, PlanRow[]>;
};
export type WeekResponse = { days: WeekDayResult[]; note: string | null; trainingDays: number[]; cuisines: string[]; feedback: boolean };

// No maxItems on `days`: Gemini (Flash and Flash-Lite) rejects a list limit nested over the per-meal limits with a
// bare 400 INVALID_ARGUMENT. repairWeek only reads weekdays 1–7, so extra days are ignored anyway.
export const weekOutput = z.object({
  days: z.array(z.object({
    weekday: z.number().describe('1 = Monday … 7 = Sunday'),
    Breakfast: planMeal, Lunch: planMeal, Snacks: planMeal, Dinner: planMeal,
  })),
  note: z.string().describe('One short sentence on how the week is shaped'),
});

// ---------- Ask Shoku ----------

/** POST /api/ai/ask ({ question, day }). Read-only: logging an idea goes through addEntries after the user taps it. */
export const askRequest = z.object({
  question: z.string().trim().min(3, 'Ask a little more, e.g. “dinner after leg day”').max(MAX_TEXT, `Keep it under ${MAX_TEXT} characters`),
  day: DAY,
  /** The member's answer when they asked to be asked before workouts are used. Ignored otherwise. */
  useWorkouts: z.boolean().optional(),
});
export type AskItem = { foodId: string; name: string; unit: string; icon: string; q: number; kcal: number; p: number };
/** `recipe` is set when the idea matches an active recipe the member can have: it opens the meal detail. */
export type AskIdea = { title: string; meal: Meal; why: string; items: AskItem[]; kcal: number; p: number; recipe?: RecipeCard };
/** What Shoku looked at, shown under the answer so the grounding is visible. */
export type AskContext = {
  workouts: { label: string; minutes: number; kcal: number }[];
  /** used: workouts were in the brief; off: the member's setting leaves them out; skipped: they said no this time. */
  workoutsUse: 'used' | 'off' | 'skipped';
  eatenKcal: number; targetKcal: number; eatenProtein: number; targetProtein: number;
  diet: string; avoiding: string[];
  /** Cuisines the ideas leaned toward (empty when open to all). */
  cuisines: string[];
  /** True when the member's meal feedback reached the brief. */
  feedback: boolean;
};
export type AskResponse = { answer: string; ideas: AskIdea[]; context: AskContext };

export const askOutput = z.object({
  answer: z.string().describe('One or two short sentences that answer the question directly'),
  ideas: z.array(z.object({
    title: z.string().describe('Short dish name, e.g. "Paneer bhurji with 2 rotis"'),
    meal: MEAL,
    why: z.string().describe('One sentence on why it fits their day: training, what is left of their targets, or their request'),
    items: z.array(z.object({ foodId: z.string(), servings: z.number() })).max(6),
  })).max(3),
});
