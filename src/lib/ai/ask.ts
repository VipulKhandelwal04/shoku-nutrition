// Pure helpers for Ask Shoku: which meal is next, and turning the model's ideas into safe, catalogue-backed ones.
import { MEALS, type Food, type Meal } from '../nutrition';
import type { AskIdea, AskItem } from './contracts';

export const MAX_IDEAS = 3;
const MAX_SERVINGS = 6;

/** The meal someone is most likely asking about: the first one not logged yet at or after this hour (IST). */
export function nextMeal(hour: number, logged: Meal[]): Meal {
  const byClock: Meal = hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 18 ? 'Snacks' : 'Dinner';
  const from = MEALS.indexOf(byClock);
  return MEALS.slice(from).find(m => !logged.includes(m)) ?? byClock;
}

/** Current hour in India time, matching the app's day boundaries. */
export function hourIst(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now)) % 24;
}

type RawIdea = { title: string; meal: Meal; why: string; items: { foodId: string; servings: number }[] };

/**
 * Keeps only foods from `eligible` (already filtered for diet, restrictions and "no X" in the question),
 * rounds portions to quarter servings within 0.25–6, merges repeats, and drops ideas left empty.
 * The model never gets the final say on what is safe to show.
 */
export function repairIdeas(raw: RawIdea[], eligible: Map<string, Food>): AskIdea[] {
  const out: AskIdea[] = [];
  for (const idea of raw) {
    const merged = new Map<string, number>();
    for (const i of idea.items) {
      if (!eligible.has(i.foodId) || !Number.isFinite(i.servings) || i.servings <= 0) continue;
      merged.set(i.foodId, (merged.get(i.foodId) ?? 0) + i.servings);
    }
    const items: AskItem[] = [...merged].map(([id, servings]) => {
      const f = eligible.get(id)!;
      const q = Math.min(MAX_SERVINGS, Math.max(0.25, Math.round(servings * 4) / 4));
      return { foodId: f.id, name: f.name, unit: f.unit, icon: f.icon, q, kcal: Math.round(f.kcal * q), p: Math.round(f.p * q) };
    });
    if (!items.length) continue;
    out.push({
      title: tidy(idea.title, 70) || items.map(i => i.name).join(' + ').slice(0, 70),
      meal: MEALS.includes(idea.meal) ? idea.meal : 'Dinner',
      why: tidy(idea.why, 180),
      items,
      kcal: items.reduce((n, i) => n + i.kcal, 0),
      p: items.reduce((n, i) => n + i.p, 0),
    });
    if (out.length === MAX_IDEAS) break;
  }
  return out;
}

export function tidy(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}
