'use client';
import { useSyncExternalStore } from 'react';
import { dateKey, type Meal } from '@/lib/nutrition';

function subscribeClock(onChange: () => void) {
  const t = setInterval(onChange, 60_000);
  const vis = () => { if (document.visibilityState === 'visible') onChange(); };
  document.addEventListener('visibilitychange', vis);
  return () => {
    clearInterval(t);
    document.removeEventListener('visibilitychange', vis);
  };
}

/** The browser's local date is the source of truth for "today". Hydrates with the server guess, then swaps. */
export function useClientToday(serverToday: string): string {
  return useSyncExternalStore(subscribeClock, () => dateKey(), () => serverToday);
}

export function useLocalHour(serverHour: number): number {
  return useSyncExternalStore(subscribeClock, () => new Date().getHours(), () => serverHour);
}

export function mealForHour(hour: number): Meal {
  if (hour < 11) return 'Breakfast';
  if (hour < 16) return 'Lunch';
  if (hour < 19) return 'Snacks';
  return 'Dinner';
}

export function greeting(hour: number): string {
  if (hour < 5) return 'Up late.';
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

export function friendlyDate(day: string, opts: { weekday?: boolean } = {}): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(opts.weekday ? { weekday: 'short' } : {}) });
}

export { fmt, qty as dec } from '@/lib/format';

export const MEAL_IMG: Record<Meal, string> = {
  Breakfast: '/img/breakfast.webp',
  Lunch: '/img/lunch.webp',
  Snacks: '/img/snacks.webp',
  Dinner: '/img/dinner.webp',
};
