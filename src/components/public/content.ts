// Built-in public content. Used when Supabase is not configured yet or a content query fails,
// so the home page and splash always render. Mirrors the seed rows in the init migration.
import type { Quote, TourSlide } from '@/lib/types';

export type QuoteLite = Pick<Quote, 'text' | 'author'>;
export type SlideLite = Pick<TourSlide, 'id' | 'title' | 'body' | 'image_url'>;

export const FALLBACK_QUOTES: QuoteLite[] = [
  { text: 'Strength is built in the kitchen too.', author: null },
  { text: 'Show up for your plate the way you show up for class.', author: null },
  { text: 'One good meal is a rep. Stack them.', author: null },
  { text: 'You don’t need perfect. You need the next meal.', author: null },
  { text: 'Fuel first. Then fly.', author: null },
  { text: 'Ghar ka khana, gym ka results.', author: null },
  { text: 'Progress is a katori at a time.', author: null },
  { text: 'Eat like you mean to finish the workout.', author: null },
];

export const FALLBACK_SLIDES: SlideLite[] = [
  { id: -1, title: 'Log a meal in seconds', body: 'Your usuals sit one tap away. Rotis, dal, curd: tap plus and it’s on the board.', image_url: '/img/lunch.webp' },
  { id: -2, title: 'Snap your plate', body: 'Take a photo and Katori suggests what’s on it and how much. You confirm before anything is saved.', image_url: '/img/breakfast.webp' },
  { id: -3, title: 'Your plate vs your plan', body: 'See the food groups you’ve hit today against India’s My Plate guide, and what to add next.', image_url: '/img/hero.webp' },
  { id: -4, title: 'Show up. Stack days.', body: 'Log three meals and the day counts. Build a streak, unlock badges, never get shamed for a slow day.', image_url: '/img/dinner.webp' },
];

/**
 * Only same-origin relative paths are allowed as post-login destinations: must start with a single "/",
 * no protocol-relative "//", no backslash tricks ("/\\evil.com"), no control characters.
 */
export function safeNext(value: string | string[] | null | undefined, fallback = '/app'): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || typeof v !== 'string') return fallback;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\\]/.test(v)) return fallback;
  if (v.length > 512) return fallback;
  return v;
}
