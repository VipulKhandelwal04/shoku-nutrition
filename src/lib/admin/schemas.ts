// Pure validation for the admin console. Mirrors the DB checks in supabase/migrations/*_init.sql so the
// operator sees field-level errors before Postgres rejects anything. No server-only imports: tests run this.
import { z } from 'zod';
import { PRIMARY_KEYS, secondaryKeys } from '../flags';
import type { GroupKey } from '../nutrition';

export const FOOD_ICONS = ['bowl', 'fruit', 'glass', 'egg', 'plate', 'roti', 'cube', 'leaf', 'nuts'] as const;
export const DIETS = ['veg', 'egg', 'nonveg'] as const;
export const GROUP_KEYS: GroupKey[] = ['cer', 'pul', 'milk', 'veg', 'fruit', 'nuts', 'oil'];
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Paneer Tikka (dry)" -> "paneer-tikka-dry". Used to suggest an id from the name on create. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Blank/whitespace -> undefined, numeric strings -> number, anything else passes through for zod to judge. */
const toNumber = (v: unknown) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? undefined : Number(t);
  }
  return v;
};

const num = (label: string, min: number, max: number, opts: { exclusiveMin?: boolean } = {}) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: `${label}: enter a number` })
      .refine(n => (opts.exclusiveMin ? n > min : n >= min), { message: opts.exclusiveMin ? `${label} must be more than ${min}` : `${label} can’t be below ${min}` })
      .refine(n => n <= max, { message: `${label} can’t be above ${max}` }),
  );

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} needs at least ${min} characters`)
    .max(max, `${label} can be at most ${max} characters`);

const groupGrams = z.preprocess(
  toNumber,
  z.number({ error: 'Enter a number' }).min(0, 'Can’t be below 0').max(5000, 'Can’t be above 5000').optional(),
);

export const foodSchema = z.object({
  id: z.string().trim().min(2, 'Id needs at least 2 characters').max(60, 'Id can be at most 60 characters').regex(SLUG_RE, 'Use lowercase letters, numbers and single hyphens (e.g. masala-dosa)'),
  name: text('Name', 1, 120),
  category: text('Category', 1, 40),
  cuisine: text('Cuisine', 1, 40),
  unit: text('Unit', 1, 40),
  grams: num('Grams', 0, 5000, { exclusiveMin: true }),
  kcal: num('Calories', 0, 10000),
  p: num('Protein', 0, 5000),
  c: num('Carbs', 0, 5000),
  f: num('Fat', 0, 5000),
  fibre: num('Fibre', 0, 5000),
  diet: z.enum(DIETS, { error: 'Pick veg, egg or non-veg' }),
  icon: z.enum(FOOD_ICONS, { error: 'Pick an icon' }),
  aliases: z.string().trim().max(300, 'Aliases can be at most 300 characters').default(''),
  groups: z
    .object({ cer: groupGrams, pul: groupGrams, milk: groupGrams, veg: groupGrams, fruit: groupGrams, nuts: groupGrams, oil: groupGrams })
    .partial()
    .default({})
    // Zeros and blanks are dropped so the stored jsonb stays as compact as the seed.
    .transform(g => Object.fromEntries(Object.entries(g).filter(([, v]) => typeof v === 'number' && v > 0)) as Partial<Record<GroupKey, number>>),
  active: z.boolean().default(true),
});
export type FoodInput = z.input<typeof foodSchema>;
export type FoodValues = z.output<typeof foodSchema>;

export const quoteSchema = z.object({
  text: text('Quote', 3, 200),
  author: z
    .string()
    .trim()
    .max(80, 'Author can be at most 80 characters')
    .nullish()
    .transform(v => (v ? v : null)),
  active: z.boolean().default(true),
});
export type QuoteValues = z.output<typeof quoteSchema>;

/** Local images ship in /public; anything else must be an https URL. */
export const imageUrlSchema = z
  .string({ error: 'Pick an image' })
  .trim()
  .min(1, 'Pick an image')
  .max(500, 'Image URL is too long')
  .refine(v => /^\/[A-Za-z0-9/_.-]+\.(webp|png|jpe?g|avif)$/.test(v) || /^https:\/\/[^\s]+$/.test(v), {
    message: 'Use a local image like /img/lunch.webp or an https:// URL',
  });

export const tourSlideSchema = z.object({
  title: text('Title', 3, 80),
  body: text('Body', 3, 280),
  image_url: imageUrlSchema,
  active: z.boolean().default(true),
});
export type TourSlideValues = z.output<typeof tourSlideSchema>;

export const aiSettingsSchema = z.object({
  enabled: z.boolean(),
  photo: z.boolean(),
  text: z.boolean(),
  plan: z.boolean(),
  coach: z.boolean(),
  ask: z.boolean(),
  daily_quota: z.preprocess(
    toNumber,
    z.number({ error: 'Enter a whole number' }).int('Use a whole number').min(1, 'At least 1 call a day').max(200, 'At most 200 calls a day'),
  ),
});

export const featureSettingsSchema = z.object({ signups_open: z.boolean() });

/** Built from the registry so a new flag needs no schema change. Every primary and secondary is required. */
export const flagsSchema = z.object(Object.fromEntries(PRIMARY_KEYS.map(p => [
  p, z.object(Object.fromEntries(['on', ...secondaryKeys(p)].map(k => [k, z.boolean()]))).strict(),
]))).strict();

export const roleSchema = z.object({ target: z.uuid('Unknown user'), role: z.enum(['user', 'admin']) });
export const disabledSchema = z.object({ target: z.uuid('Unknown user'), disabled: z.boolean() });
export const idSchema = z.number().int().positive();
export const moveSchema = z.object({ id: idSchema, dir: z.enum(['up', 'down']) });

export type FieldErrors = Record<string, string>;
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: FieldErrors };

/** First message per field, keyed by dotted path ("groups.milk"). */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): ActionResult {
  const fe = fieldErrors(error);
  const first = Object.values(fe)[0];
  return { ok: false, error: first ?? 'Check the highlighted fields.', fieldErrors: fe };
}
