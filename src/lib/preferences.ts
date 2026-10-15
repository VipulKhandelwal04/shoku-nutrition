// Meal-idea preferences a member saves in Profile: cuisines (Food style) and activity context, plus the
// fixed vocabulary for meal feedback. Pure and safe to import from client or server.
import { z } from 'zod';
import { MEALS } from './nutrition';

export const CUISINE_MODES = [
  { key: 'open', label: 'Open to all', blurb: 'Any cuisine that fits your day' },
  { key: 'familiar', label: 'Mostly familiar', blurb: 'Lean toward home-style Indian meals' },
  { key: 'chosen', label: 'Pick cuisines', blurb: 'Lean toward the cuisines you choose' },
] as const;
export type CuisineMode = (typeof CUISINE_MODES)[number]['key'];
const MODE_KEYS = CUISINE_MODES.map(m => m.key) as [CuisineMode, ...CuisineMode[]];

/** Cuisines members can pick. The catalogue's own cuisines are added to these at render time. */
export const CUISINE_CHOICES = ['Indian', 'Chinese', 'Italian', 'Mediterranean', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Mexican', 'Continental'];
export const MAX_CUISINES = 12;

export type CuisinePrefs = { mode: CuisineMode; chosen: string[] };
export const OPEN_CUISINES: CuisinePrefs = { mode: 'open', chosen: [] };

export const cuisinePrefsSchema = z.object({
  mode: z.enum(MODE_KEYS),
  chosen: z.array(z.string().trim().min(1).max(40)).max(MAX_CUISINES, `Pick up to ${MAX_CUISINES} cuisines`),
}).refine(p => p.mode !== 'chosen' || p.chosen.length > 0, { message: 'Pick at least one cuisine, or choose “Open to all”.' });

export const activityPrefsSchema = z.object({ useWorkouts: z.boolean(), askFirst: z.boolean() });

/** Profile columns → prefs. Unknown or missing values read as today's behaviour. */
export function cuisinePrefsOf(p: { cuisine_mode?: string | null; cuisines?: string[] | null }): CuisinePrefs {
  const mode = (MODE_KEYS as string[]).includes(p.cuisine_mode ?? '') ? (p.cuisine_mode as CuisineMode) : 'open';
  return { mode, chosen: p.cuisines ?? [] };
}

/** Short summary for the Profile row, e.g. "Open to all cuisines" or "Leaning Italian, Thai". */
export function cuisineSummary(p: CuisinePrefs): string {
  if (p.mode === 'familiar') return 'Mostly familiar meals';
  if (p.mode === 'chosen' && p.chosen.length) return `Leaning ${p.chosen.slice(0, 3).join(', ')}${p.chosen.length > 3 ? ` +${p.chosen.length - 3}` : ''}`;
  return 'Open to all cuisines';
}

// ---------- Meal feedback ----------

export const RATINGS = [
  { key: 'like', label: 'Like it' },
  { key: 'okay', label: 'It’s okay' },
  { key: 'no', label: 'Not for me' },
] as const;
export type Rating = (typeof RATINGS)[number]['key'];

export const FEEDBACK_TAGS = [
  { key: 'loved_it', label: 'Loved it' },
  { key: 'too_heavy', label: 'Too heavy' },
  { key: 'too_light', label: 'Not filling' },
  { key: 'too_long', label: 'Too long to make' },
  { key: 'not_my_cuisine', label: 'Not my cuisine' },
] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number]['key'];
export const MAX_NOTE = 200;

export const feedbackSchema = z.object({
  kind: z.enum(['entry', 'idea']),
  entryId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  meal: z.enum(MEALS),
  foodIds: z.array(z.string().min(1).max(80)).max(12),
  rating: z.enum(RATINGS.map(r => r.key) as [Rating, ...Rating[]]),
  tags: z.array(z.enum(FEEDBACK_TAGS.map(t => t.key) as [FeedbackTag, ...FeedbackTag[]])).max(FEEDBACK_TAGS.length),
  note: z.string().trim().max(MAX_NOTE, `Keep the note under ${MAX_NOTE} characters`).optional(),
}).refine(f => f.kind !== 'entry' || !!f.entryId, { message: 'Pick the meal to rate' });
export type FeedbackInput = z.input<typeof feedbackSchema>;

export type FeedbackRow = {
  id: string;
  entry_id: string | null;
  kind: 'entry' | 'idea';
  title: string;
  meal: string;
  food_ids: string[];
  rating: Rating;
  tags: FeedbackTag[];
  note: string | null;
  created_at: string;
};

export const ratingLabel = (r: Rating) => RATINGS.find(x => x.key === r)?.label ?? r;
export const tagLabel = (t: string) => FEEDBACK_TAGS.find(x => x.key === t)?.label ?? t;
