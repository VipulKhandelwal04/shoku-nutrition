// Feedback summary: turns a member's meal ratings into soft signals for suggestions. Pure; tested.
// Likes raise a food's weight, "not for me" lowers it. Nothing is ever filtered out by feedback alone.
import type { FeedbackRow } from '../preferences';

export type FeedbackSummary = {
  /** Food id → weight multiplier (above 1 = liked, below 1 = not for me). Foods not listed stay at 1. */
  factor: Map<string, number>;
  /** Titles of meals the member liked, newest first, to bring back when they fit. */
  likedMeals: string[];
  /** True when there is any signal at all. */
  any: boolean;
};

export const EMPTY_FEEDBACK: FeedbackSummary = { factor: new Map(), likedMeals: [], any: false };

const SCORE = { like: 1, okay: 0, no: -1 } as const;
/** Multiplier per net point, capped so one strong opinion can't dominate. */
const STEP = 0.25;
const MIN_FACTOR = 0.4;
const MAX_FACTOR = 1.75;
export const MAX_LIKED_MEALS = 5;

/** Ratings (any order) → per-food weight factors and liked meal titles. */
export function feedbackSummary(rows: Pick<FeedbackRow, 'food_ids' | 'rating' | 'title' | 'created_at'>[]): FeedbackSummary {
  const net = new Map<string, number>();
  for (const r of rows) {
    const s = SCORE[r.rating] ?? 0;
    if (!s) continue;
    for (const id of new Set(r.food_ids)) net.set(id, (net.get(id) ?? 0) + s);
  }
  const factor = new Map<string, number>();
  for (const [id, n] of net) {
    if (!n) continue;
    factor.set(id, Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, 1 + n * STEP)));
  }
  const likedMeals = [...rows]
    .filter(r => r.rating === 'like')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(r => r.title.trim())
    .filter((t, i, all) => t && all.indexOf(t) === i)
    .slice(0, MAX_LIKED_MEALS);
  return { factor, likedMeals, any: factor.size > 0 || likedMeals.length > 0 };
}
