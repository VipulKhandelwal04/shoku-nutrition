// Pure helpers for Onboarding, Compare, Progress and Profile. No I/O, so everything here is unit tested.
// Relative imports on purpose: vitest runs without the `@/` alias.
import {
  MEALS, dayCounts, isValidProfile, planCheck, shiftDate, totals,
  type BodyProfile, type Diet, type Entry, type Food, type GroupKey, type GroupStatus, type Macros, type Meal, type Plan, type Targets,
} from '../../../lib/nutrition';
import type { DayRow, EntryRow, Profile, WorkoutRow } from '../../../lib/types';

// ---------- Dates ----------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TZ_COOKIE = 'shoku-tz';
export const DEFAULT_TZ = 'Asia/Kolkata';

export function validTimeZone(tz: string | undefined | null): string | null {
  if (!tz || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Today's date key in the user's time zone (from the <DeviceTimeZone> cookie), India time by default. */
export function todayIn(tz: string | undefined | null, now = new Date()): string {
  const zone = validTimeZone(tz) ?? DEFAULT_TZ;
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** A valid YYYY-MM-DD that is not after `max`; otherwise `fallback`. */
export function parseDayParam(value: string | string[] | undefined, fallback: string, max: string): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !DAY_RE.test(v) || Number.isNaN(new Date(`${v}T12:00:00`).getTime()) || shiftDate(v, 0) !== v) return fallback;
  return v > max ? max : v;
}

/** The 7 date keys ending on `end`, oldest first. */
export function weekKeys(end: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(end, i - 6));
}

export function friendlyDay(key: string, today: string, opts: { short?: boolean } = {}): string {
  if (key === today) return 'Today';
  if (key === shiftDate(today, -1)) return 'Yesterday';
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString('en-IN', opts.short ? { day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' });
}

export function weekdayShort(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
}

// ---------- Entries and days ----------

export function toEntries(rows: Pick<EntryRow, 'id' | 'meal' | 'quantity' | 'food'>[]): Entry[] {
  return rows.map(r => ({ id: r.id, meal: r.meal, quantity: Number(r.quantity), food: { ...r.food, groups: r.food.groups ?? {} } }));
}

export type DaySummary = { day: string; entries: Entry[]; meals: number; counted: boolean; totals: Macros; water: number };

export function summariseDays(keys: string[], rows: Pick<EntryRow, 'id' | 'day' | 'meal' | 'quantity' | 'food'>[], days: Pick<DayRow, 'day' | 'water_ml'>[] = []): DaySummary[] {
  return keys.map(day => {
    const entries = toEntries(rows.filter(r => r.day === day));
    const meals = new Set(entries.map(e => e.meal)).size;
    return { day, entries, meals, counted: dayCounts(meals), totals: totals(entries), water: days.find(d => d.day === day)?.water_ml ?? 0 };
  });
}

/**
 * Average a period as one "typical day": every entry from counted days, with quantities divided by the number of
 * counted days. Feeding these to totals()/groupStatus() gives per-day averages.
 */
export function averageDay(summaries: DaySummary[]): { entries: Entry[]; days: number } {
  const counted = summaries.filter(s => s.counted);
  const n = counted.length;
  if (!n) return { entries: [], days: 0 };
  return { entries: counted.flatMap(s => s.entries.map(e => ({ ...e, quantity: e.quantity / n }))), days: n };
}

// ---------- Food style and restrictions ----------

export const DIETS: { key: Diet; label: string; blurb: string }[] = [
  { key: 'veg', label: 'Veg', blurb: 'No meat, fish or eggs' },
  { key: 'egg', label: 'Eggetarian', blurb: 'Veg plus eggs' },
  { key: 'nonveg', label: 'Non-veg', blurb: 'Everything on the menu' },
];

// ---------- Plan ----------

/** Validates a stored user_plans.plan (jsonb) against the catalogue. Returns null when unusable. */
export type Suggestion = { foodId: string; name: string; unit: string; icon: string; meal: Meal; quantity: number; kcal: number; fills: GroupKey; fillsLabel: string };

/**
 * Up to `max` one-tap suggestions that fill missing "at least" food groups using what is still left in the plan.
 * Skips foods that would push a "limit" group (cereals, oils) further over, and foods already suggested.
 */
export function nextUp(plan: Plan, entries: Entry[], statuses: GroupStatus[], foodsById: Map<string, Food>, max = 3, fromMeal?: Meal): Suggestion[] {
  const over = new Set(statuses.filter(s => s.status === 'over').map(s => s.key));
  const gaps = statuses
    .filter(s => s.kind === 'atleast' && s.status !== 'hit' && s.target > 0)
    .sort((a, b) => a.eaten / a.target - b.eaten / b.target);
  const check = planCheck(plan, entries, foodsById);
  const all = check.rows.flatMap(r => r.items.filter(i => i.left > 0 && i.food).map(i => ({ ...i, meal: r.meal })));
  // On an open day, suggest from the meal that's next by the clock onwards (no snacks at 8am), unless nothing is left there.
  const from = fromMeal ? MEALS.indexOf(fromMeal) : 0;
  const upcoming = all.filter(i => MEALS.indexOf(i.meal) >= from);
  const open = upcoming.length ? upcoming : all;
  const out: Suggestion[] = [];
  const used = new Set<string>();
  for (const gap of gaps) {
    if (out.length >= max) break;
    const pick = open
      .filter(i => !used.has(i.foodId) && (i.food.groups?.[gap.key] ?? 0) > 0 && !Object.keys(i.food.groups ?? {}).some(k => over.has(k as GroupKey)))
      .sort((a, b) => (b.food.groups?.[gap.key] ?? 0) * b.left - (a.food.groups?.[gap.key] ?? 0) * a.left)[0];
    if (!pick) continue;
    used.add(pick.foodId);
    out.push({
      foodId: pick.foodId, name: pick.food.name, unit: pick.food.unit, icon: pick.food.icon, meal: pick.meal,
      quantity: pick.left, kcal: Math.round(pick.food.kcal * pick.left), fills: gap.key, fillsLabel: gap.label,
    });
  }
  return out;
}

const PLURAL: Record<string, string> = { bowl: 'bowls', katori: 'katoris', roti: 'rotis', cup: 'cups', glass: 'glasses', piece: 'pieces', slice: 'slices', handful: 'handfuls', plate: 'plates', egg: 'eggs', spoon: 'spoons', tbsp: 'tbsp', tsp: 'tsp' };

/** "2 bowls", "1 bowl", "0.5 bowl". Only pluralises unit words it knows; anything else is left as is. */
export function unitFor(quantity: number, unit: string): string {
  return quantity > 1 && PLURAL[unit] ? PLURAL[unit] : unit;
}

/** Per food group, which foods filled it (grams or ml), biggest first. Same food logged twice is merged. */
export function groupContributions(entries: Pick<Entry, 'food' | 'quantity'>[]): Record<GroupKey, { name: string; amount: number }[]> {
  const out = { cer: [], pul: [], milk: [], veg: [], fruit: [], nuts: [], oil: [] } as Record<GroupKey, { name: string; amount: number }[]>;
  for (const e of entries) {
    for (const [k, v] of Object.entries(e.food.groups ?? {})) {
      const amount = (v ?? 0) * e.quantity;
      if (amount <= 0) continue;
      const list = out[k as GroupKey];
      if (!list) continue;
      const hit = list.find(x => x.name === e.food.name);
      if (hit) hit.amount += amount; else list.push({ name: e.food.name, amount });
    }
  }
  for (const k of Object.keys(out) as GroupKey[]) out[k].sort((a, b) => b.amount - a.amount);
  return out;
}

export function groupsOnTrack(statuses: GroupStatus[]): number {
  return statuses.filter(s => s.status === 'hit').length;
}

// ---------- Nutrients ----------

export type ChipStatus = GroupStatus['status'];
export type NutrientKind = 'target' | 'atleast' | 'limit';

/** Same no-shame rule as food groups: an open day's shortfall is "so far", never "low". */
export function nutrientStatus(eaten: number, target: number, kind: NutrientKind, dayOpen: boolean): ChipStatus {
  const r = target > 0 ? eaten / target : 0;
  if (kind === 'limit') return r <= 1.1 ? 'hit' : 'over';
  if (kind === 'target' && r > 1.1) return 'over';
  return r >= 0.9 ? 'hit' : dayOpen ? 'so-far' : 'low';
}

export const CHIP: Record<ChipStatus, { label: string; tone: '' | 'ok' | 'warn' | 'accent' }> = {
  hit: { label: 'On track', tone: 'ok' },
  'so-far': { label: 'So far', tone: '' },
  low: { label: 'Low', tone: 'warn' },
  over: { label: 'Over limit', tone: 'accent' },
};

/** Share of energy from protein, carbs and fat (percent). Null when nothing was eaten. */
export function energySplit(m: Pick<Macros, 'p' | 'c' | 'f'>): { p: number; c: number; f: number } | null {
  const e = m.p * 4 + m.c * 4 + m.f * 9;
  if (e <= 0) return null;
  return { p: (m.p * 4 / e) * 100, c: (m.c * 4 / e) * 100, f: (m.f * 9 / e) * 100 };
}

// ---------- Targets and BMI ----------

export function sameTargets(a: Targets | null | undefined, b: Targets): boolean {
  return !!a && a.kcal === b.kcal && a.p === b.p && a.c === b.c && a.f === b.f && a.water === b.water;
}

/** The body profile stored on a profiles row, or null when it is incomplete. */
export function bodyOf(p: Pick<Profile, 'goal' | 'sex' | 'age' | 'height_cm' | 'weight_kg' | 'activity'>): BodyProfile | null {
  const b = { goal: p.goal ?? undefined, sex: p.sex ?? undefined, age: num(p.age), height: num(p.height_cm), weight: num(p.weight_kg), activity: p.activity ?? undefined };
  return isValidProfile(b) ? b : null;
}
const num = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v));

export function pickTargets(r: Targets): Targets {
  return { kcal: r.kcal, p: r.p, c: r.c, f: r.f, water: r.water };
}

/** BMI bands using the Asia-Pacific cut-offs ICMR uses for Indian adults. Neutral wording on purpose. */
export function bmiBand(bmi: number): string {
  if (bmi < 18.5) return 'Below 18.5';
  if (bmi < 23) return 'In the 18.5–22.9 range';
  if (bmi < 25) return 'In the 23–24.9 range';
  return '25 or above';
}

// ---------- Progress ----------

export type WeekStats = { countedDays: number; loggedDays: number; avgKcal: number | null; avgProtein: number | null; water: number; bestDay: DaySummary | null };

export function weekStats(summaries: DaySummary[], kcalTarget: number): WeekStats {
  const counted = summaries.filter(s => s.counted);
  const n = counted.length;
  const avg = (k: keyof Macros) => (n ? counted.reduce((t, s) => t + s.totals[k], 0) / n : null);
  const bestDay = counted.reduce<DaySummary | null>((best, s) => {
    if (!best) return s;
    return Math.abs(s.totals.kcal - kcalTarget) < Math.abs(best.totals.kcal - kcalTarget) ? s : best;
  }, null);
  return {
    countedDays: n,
    loggedDays: summaries.filter(s => s.entries.length > 0).length,
    avgKcal: avg('kcal'),
    avgProtein: avg('p'),
    water: summaries.reduce((t, s) => t + s.water, 0),
    bestDay,
  };
}

// ---------- Today timeline and workout weeks ----------

/** Where a moment falls on the member's clock: local day and minutes after midnight. */
export type LocalClock = (iso: string) => { day: string; minutes: number };

/** A LocalClock for an IANA time zone (the device's when omitted). */
export function clockIn(timeZone?: string): LocalClock {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return iso => {
    const p = Object.fromEntries(f.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  };
}

/** Usual meal times, for meals logged on a different day (back-filled) where the log time says nothing. */
export const USUAL_MEAL_MINUTES: Record<Meal, number> = { Breakfast: 8 * 60, Lunch: 13 * 60, Snacks: 17 * 60, Dinner: 20 * 60 + 30 };

export type TimelineItem =
  | { kind: 'meal'; key: string; meal: Meal; at: number; timed: 'logged' | 'usual'; names: string[]; kcal: number }
  | { kind: 'workout'; key: string; label: string; at: number; timed: 'start' | 'logged'; minutes: number; kcal: number; source: WorkoutRow['source'] };

/** "HH:MM[:SS]" → minutes after midnight, or null. */
export function parseClock(t: string | null | undefined): number | null {
  const m = t ? /^([01]\d|2[0-3]):([0-5]\d)/.exec(t) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Today so far: meals and workouts in time order. A workout uses its start time; without one it is placed by when
 * it was recorded. A meal uses when its first food was logged, or its usual time if it was logged on another day.
 * Ties put the workout first.
 */
export function dayTimeline(
  day: string,
  entries: Pick<EntryRow, 'meal' | 'food' | 'quantity' | 'created_at'>[],
  workouts: Pick<WorkoutRow, 'id' | 'day' | 'label' | 'minutes' | 'kcal' | 'source' | 'start_time' | 'created_at' | 'hidden'>[],
  clock: LocalClock,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const meal of MEALS) {
    const list = entries.filter(e => e.meal === meal);
    if (!list.length) continue;
    const first = list.map(e => e.created_at).sort()[0];
    const local = clock(first);
    const sameDay = local.day === day;
    items.push({
      kind: 'meal', key: `meal-${meal}`, meal, at: sameDay ? local.minutes : USUAL_MEAL_MINUTES[meal], timed: sameDay ? 'logged' : 'usual',
      names: list.map(e => e.food.name.split(',')[0]), kcal: Math.round(totals(list).kcal),
    });
  }
  for (const w of workouts) {
    if (w.day !== day || w.hidden) continue;
    const start = parseClock(w.start_time);
    items.push({
      kind: 'workout', key: `workout-${w.id}`, label: w.label, at: start ?? clock(w.created_at).minutes, timed: start !== null ? 'start' : 'logged',
      minutes: w.minutes, kcal: w.kcal, source: w.source,
    });
  }
  return items.sort((a, b) => a.at - b.at || (a.kind === b.kind ? 0 : a.kind === 'workout' ? -1 : 1));
}

/** Minutes after midnight → "7:05 AM". */
export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24, m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export type WorkoutWeek = {
  days: { day: string; workouts: number; minutes: number; kcal: number }[];
  sessions: number;
  minutes: number;
  kcal: number;
  bySource: { manual: number; strava: number };
};

/** Totals for a week of workouts (hidden ones never count), with one row per day of `keys`, oldest first. */
export function workoutWeek(keys: string[], workouts: Pick<WorkoutRow, 'day' | 'minutes' | 'kcal' | 'source' | 'hidden'>[]): WorkoutWeek {
  const shown = workouts.filter(w => !w.hidden && keys.includes(w.day));
  const days = keys.map(day => {
    const list = shown.filter(w => w.day === day);
    return { day, workouts: list.length, minutes: list.reduce((n, w) => n + w.minutes, 0), kcal: list.reduce((n, w) => n + w.kcal, 0) };
  });
  return {
    days,
    sessions: shown.length,
    minutes: days.reduce((n, d) => n + d.minutes, 0),
    kcal: days.reduce((n, d) => n + d.kcal, 0),
    bySource: { manual: shown.filter(w => w.source === 'manual').length, strava: shown.filter(w => w.source === 'strava').length },
  };
}
