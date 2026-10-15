// Validation shared by the onboarding and profile server actions. Ranges mirror isValidProfile and the DB checks.
import { z } from 'zod';
import { RESTRICTION_SLUGS } from './insights';

export const TARGET_RANGES = {
  kcal: { min: 800, max: 6000, unit: 'kcal', label: 'Calories' },
  p: { min: 10, max: 400, unit: 'g', label: 'Protein' },
  c: { min: 0, max: 900, unit: 'g', label: 'Carbs' },
  f: { min: 10, max: 300, unit: 'g', label: 'Fat' },
  water: { min: 500, max: 6000, unit: 'ml', label: 'Water' },
} as const;
export type TargetKey = keyof typeof TARGET_RANGES;
export const TARGET_KEYS = Object.keys(TARGET_RANGES) as TargetKey[];

export const BODY_RANGES = {
  age: { min: 18, max: 100, label: 'Age', unit: 'years' },
  height: { min: 120, max: 230, label: 'Height', unit: 'cm' },
  weight: { min: 30, max: 300, label: 'Weight', unit: 'kg' },
} as const;

const ranged = (k: TargetKey) =>
  z.number({ error: `Enter ${TARGET_RANGES[k].label.toLowerCase()}` })
    .int(`${TARGET_RANGES[k].label}: use a whole number`)
    .min(TARGET_RANGES[k].min, `${TARGET_RANGES[k].label}: ${TARGET_RANGES[k].min}–${TARGET_RANGES[k].max} ${TARGET_RANGES[k].unit}`)
    .max(TARGET_RANGES[k].max, `${TARGET_RANGES[k].label}: ${TARGET_RANGES[k].min}–${TARGET_RANGES[k].max} ${TARGET_RANGES[k].unit}`);

export const targetsSchema = z.object({ kcal: ranged('kcal'), p: ranged('p'), c: ranged('c'), f: ranged('f'), water: ranged('water') });

export const bodySchema = z.object({
  goal: z.enum(['lose', 'fit', 'muscle'], { error: 'Pick a goal' }),
  sex: z.enum(['female', 'male'], { error: 'Pick the body type for the calorie estimate' }),
  age: z.number({ error: 'Enter your age' }).int('Age: use whole years').min(18, 'Shoku is for adults 18 and over').max(100, 'Age: 18–100 years'),
  height: z.number({ error: 'Enter your height' }).min(120, 'Height: 120–230 cm').max(230, 'Height: 120–230 cm'),
  weight: z.number({ error: 'Enter your weight' }).min(30, 'Weight: 30–300 kg').max(300, 'Weight: 30–300 kg'),
  activity: z.enum(['sedentary', 'light', 'moderate', 'high'], { error: 'Pick an activity level' }),
  diet: z.enum(['veg', 'egg', 'nonveg'], { error: 'Pick a food style' }),
  restrictions: z.array(z.enum(RESTRICTION_SLUGS)).max(RESTRICTION_SLUGS.length).transform(r => [...new Set(r)]),
});

export const onboardingSchema = bodySchema.extend({ targets: targetsSchema });

export type BodyInput = z.input<typeof bodySchema>;
export type OnboardingInput = z.input<typeof onboardingSchema>;

/** Inline validation for a single numeric field, matching the schema ranges. Empty string means "no error yet". */
export function rangeError(value: string, min: number, max: number, label: string, unit: string, opts: { int?: boolean } = {}): string {
  if (value.trim() === '') return `Enter ${label.toLowerCase()}`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label}: numbers only`;
  if (opts.int && !Number.isInteger(n)) return `${label}: use a whole number`;
  if (n < min || n > max) return `${label}: ${min}–${max} ${unit}`;
  return '';
}

export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Check your details and try again';
}
