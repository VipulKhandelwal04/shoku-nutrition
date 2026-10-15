// Built-in public content. Used when Supabase is not configured yet or a content query fails,
// so the home page and splash always render. Mirrors the seed rows in the init migration.
import type { Quote, TourSlide } from '@/lib/types';

export type QuoteLite = Pick<Quote, 'text' | 'author'>;
export type SlideLite = Pick<TourSlide, 'id' | 'title' | 'body' | 'image_url'>;

export const FALLBACK_QUOTES: QuoteLite[] = [
  { text: 'You don’t need perfect. You need the next meal.', author: null },
  { text: 'Hara hachi bu: stop at eight parts full.', author: 'Okinawan saying' },
  { text: 'Ichiju sansai: one soup, three sides.', author: 'Japanese home cooking' },
  { text: 'Ghar ka khana, gym ka results.', author: null },
  { text: 'Progress is a katori at a time.', author: null },
  { text: 'Skipped breakfast? Lunch still counts.', author: null },
  { text: 'Eat like you mean to finish the workout.', author: null },
  { text: 'Train hard. Then eat a proper lunch.', author: null },
];

export const FALLBACK_SLIDES: SlideLite[] = [
  { id: -1, title: 'Log a meal in seconds', body: 'Your usual foods sit one tap away. Roti, dal, curd: tap plus and they’re in today’s diary.', image_url: '/img/lunch.webp' },
  { id: -2, title: 'Snap your plate', body: 'Take a photo and AI Assist suggests the dishes and portions. Nothing is saved until you confirm.', image_url: '/img/breakfast.webp' },
  { id: -3, title: 'Your plate vs your plan', body: 'See which food groups today’s meals have covered and what to add next.', image_url: '/img/hero.webp' },
  { id: -4, title: 'Three meals, one day', body: 'Log any three meals and the day joins your streak. A slow day doesn’t cost you anything.', image_url: '/img/dinner.webp' },
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
