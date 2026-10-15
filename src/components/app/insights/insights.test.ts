import { describe, expect, it } from 'vitest';
import { buildPlan, groupStatus, recommend, type Entry, type Food, type Meal } from '../../../lib/nutrition';
import { SEED_FOODS } from '../../../lib/seed-foods';
import {
  averageDay, bmiBand, bodyOf, energySplit, filterPlan, foodFits, groupContributions, nextUp, nutrientStatus,
  parseDayParam, parseStoredPlan, sameTargets, summariseDays, todayIn, weekKeys, weekStats,
  USUAL_MEAL_MINUTES, clockIn, clockLabel, dayTimeline, parseClock, workoutWeek,
} from './insights';
import type { WorkoutRow } from '../../../lib/types';
import { bodySchema, onboardingSchema, rangeError, targetsSchema } from './schemas';

const byId = new Map<string, Food>(SEED_FOODS.map(f => [f.id, f]));
const food = (id: string) => byId.get(id)!;
let n = 0;
const entry = (id: string, meal: Entry['meal'], quantity = 1) => ({ id: `e${n++}`, meal, quantity, food: food(id) });
const row = (day: string, id: string, meal: Entry['meal'], quantity = 1) => ({ ...entry(id, meal, quantity), day });

describe('dates', () => {
  it('parses valid day params and rejects junk or future days', () => {
    expect(parseDayParam('2026-10-10', '2026-10-15', '2026-10-15')).toBe('2026-10-10');
    expect(parseDayParam(['2026-10-11', 'x'], '2026-10-15', '2026-10-15')).toBe('2026-10-11');
    expect(parseDayParam('2026-10-20', '2026-10-15', '2026-10-15')).toBe('2026-10-15');
    expect(parseDayParam('2026-02-31', 'F', '2026-10-15')).toBe('F');
    expect(parseDayParam('nope', 'F', '2026-10-15')).toBe('F');
    expect(parseDayParam(undefined, 'F', '2026-10-15')).toBe('F');
  });
  it('builds a 7-day window ending on the given day, across month ends', () => {
    expect(weekKeys('2026-11-02')).toEqual(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('computes today in the user time zone, defaulting to India', () => {
    const t = new Date('2026-10-15T20:00:00Z'); // 01:30 on the 16th in India, 16:00 on the 15th in New York
    expect(todayIn(null, t)).toBe('2026-10-16');
    expect(todayIn('America/New_York', t)).toBe('2026-10-15');
    expect(todayIn('Not/AZone', t)).toBe('2026-10-16');
  });
});

describe('diet and restrictions', () => {
  it('respects food style', () => {
    expect(foodFits(food('chicken'), 'veg', [])).toBe(false);
    expect(foodFits(food('egg'), 'egg', [])).toBe(true);
    expect(foodFits(food('chicken'), 'egg', [])).toBe(false);
    expect(foodFits(food('chicken'), 'nonveg', [])).toBe(true);
  });
  it('screens restrictions by keyword and food group', () => {
    expect(foodFits(food('paratha'), 'veg', ['jain'])).toBe(false); // aloo
    expect(foodFits(food('egg'), 'nonveg', ['jain'])).toBe(false); // jain is veg
    expect(foodFits(food('curd'), 'veg', ['lactose-free'])).toBe(false);
    expect(foodFits(food('chai'), 'veg', ['lactose-free'])).toBe(false);
    expect(foodFits(food('almonds'), 'veg', ['nut-allergy'])).toBe(false);
    expect(foodFits(food('chapati'), 'veg', ['gluten-free'])).toBe(false);
    expect(foodFits(food('rice'), 'veg', ['gluten-free'])).toBe(true);
    expect(foodFits(food('chai'), 'veg', ['diabetic-friendly'])).toBe(false); // sweetened
    expect(foodFits(food('dal'), 'veg', ['jain', 'gluten-free', 'diabetic-friendly'])).toBe(true);
  });
  it('filters a plan to what fits', () => {
    const plan = filterPlan(buildPlan({ kcal: 2000 }, 'fit', 'veg', byId), byId, 'veg', ['lactose-free', 'gluten-free']);
    const ids = Object.values(plan).flat().map(i => i.foodId);
    expect(ids).not.toContain('milk');
    expect(ids).not.toContain('chapati');
    expect(ids).toContain('dal');
  });
});

describe('stored plan', () => {
  it('keeps valid items and drops unknown foods or bad quantities', () => {
    const plan = parseStoredPlan({ Breakfast: [{ foodId: 'oats', q: 1, flex: true }, { foodId: 'ghost', q: 1 }], Lunch: [{ foodId: 'dal', q: -1 }], Dinner: 'x' }, byId);
    expect(plan?.Breakfast).toEqual([{ foodId: 'oats', q: 1, flex: true }]);
    expect(plan?.Lunch).toEqual([]);
    expect(plan?.Dinner).toEqual([]);
  });
  it('returns null for empty or junk plans', () => {
    expect(parseStoredPlan(null, byId)).toBeNull();
    expect(parseStoredPlan({ Breakfast: [] }, byId)).toBeNull();
  });
});

describe('next up', () => {
  const plan = buildPlan({ kcal: 2000 }, 'fit', 'veg', byId);
  it('suggests planned foods that fill the biggest gaps, at most 3', () => {
    const entries = [entry('chapati', 'Lunch', 2)];
    const s = nextUp(plan, entries, groupStatus(entries, 2000, true), byId);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(new Set(s.map(x => x.foodId)).size).toBe(s.length);
    for (const x of s) expect(food(x.foodId).groups[x.fills]).toBeGreaterThan(0);
    expect(s.every(x => x.foodId !== 'chapati' || x.quantity > 0)).toBe(true);
  });
  it('never suggests foods that add to an over-limit group', () => {
    const entries = [entry('oil', 'Lunch', 20), entry('rice', 'Lunch', 8)];
    const statuses = groupStatus(entries, 2000, true);
    expect(statuses.find(g => g.key === 'oil')?.status).toBe('over');
    const s = nextUp(plan, entries, statuses, byId);
    for (const x of s) {
      expect(food(x.foodId).groups.oil ?? 0).toBe(0);
      expect(food(x.foodId).groups.cer ?? 0).toBe(0);
    }
  });
  it('is empty when every group is on track', () => {
    const full = groupStatus([], 2000, true).map(g => ({ ...g, status: 'hit' as const }));
    expect(nextUp(plan, [], full, byId)).toEqual([]);
  });
});

describe('summaries and averages', () => {
  const keys = weekKeys('2026-10-15');
  const rows = [
    row('2026-10-14', 'oats', 'Breakfast'), row('2026-10-14', 'dal', 'Lunch'), row('2026-10-14', 'chapati', 'Dinner', 2),
    row('2026-10-15', 'oats', 'Breakfast'),
  ];
  const sums = summariseDays(keys, rows, [{ day: '2026-10-14', water_ml: 1500 }]);
  it('counts a day at 3+ meals', () => {
    expect(sums.find(s => s.day === '2026-10-14')?.counted).toBe(true);
    expect(sums.find(s => s.day === '2026-10-15')?.counted).toBe(false);
  });
  it('averages over counted days only', () => {
    const avg = averageDay(sums);
    expect(avg.days).toBe(1);
    expect(avg.entries).toHaveLength(3);
    expect(averageDay(sums.map(s => ({ ...s, counted: false })))).toEqual({ entries: [], days: 0 });
  });
  it('builds week stats with water and a best day', () => {
    const st = weekStats(sums, 2000);
    expect(st.countedDays).toBe(1);
    expect(st.loggedDays).toBe(2);
    expect(st.water).toBe(1500);
    expect(st.bestDay?.day).toBe('2026-10-14');
    expect(weekStats(summariseDays(keys, []), 2000)).toMatchObject({ countedDays: 0, avgKcal: null, avgProtein: null, bestDay: null });
  });
  it('merges group contributions per food', () => {
    const c = groupContributions([entry('dal', 'Lunch'), entry('dal', 'Dinner'), entry('sambar', 'Lunch')]);
    expect(c.pul[0]).toEqual({ name: 'Yellow dal', amount: 60 });
    expect(c.pul).toHaveLength(2);
    expect(c.fruit).toEqual([]);
  });
});

describe('statuses and numbers', () => {
  it('never says low while the day is open', () => {
    expect(nutrientStatus(10, 100, 'atleast', true)).toBe('so-far');
    expect(nutrientStatus(10, 100, 'atleast', false)).toBe('low');
    expect(nutrientStatus(95, 100, 'atleast', false)).toBe('hit');
    expect(nutrientStatus(120, 100, 'limit', true)).toBe('over');
    expect(nutrientStatus(120, 100, 'target', true)).toBe('over');
    expect(nutrientStatus(50, 100, 'limit', false)).toBe('hit');
  });
  it('splits energy and handles nothing eaten', () => {
    const sp = energySplit({ p: 25, c: 50, f: 0 })!;
    expect(sp.p).toBeCloseTo(33.33, 1);
    expect(energySplit({ p: 0, c: 0, f: 0 })).toBeNull();
  });
  it('uses ICMR Asian BMI cut-offs', () => {
    expect(bmiBand(18)).toBe('Below 18.5');
    expect(bmiBand(22.9)).toBe('In the 18.5–22.9 range');
    expect(bmiBand(24)).toBe('In the 23–24.9 range');
    expect(bmiBand(25)).toBe('25 or above');
  });
  it('reads a body profile from a profiles row', () => {
    const p = { goal: 'fit' as const, sex: 'female' as const, age: 30, height_cm: 160, weight_kg: 58, activity: 'light' as const };
    expect(bodyOf(p)).toEqual({ goal: 'fit', sex: 'female', age: 30, height: 160, weight: 58, activity: 'light' });
    expect(bodyOf({ ...p, age: null })).toBeNull();
    const r = recommend(bodyOf(p)!);
    expect(sameTargets({ kcal: r.kcal, p: r.p, c: r.c, f: r.f, water: r.water }, r)).toBe(true);
    expect(sameTargets(null, r)).toBe(false);
  });
});

describe('schemas', () => {
  const ok = { goal: 'fit', sex: 'male', age: 30, height: 175, weight: 72, activity: 'moderate', diet: 'veg', restrictions: ['jain', 'jain'] } as const;
  it('accepts a valid body and de-duplicates restrictions', () => {
    const r = bodySchema.safeParse(ok);
    expect(r.success && r.data.restrictions).toEqual(['jain']);
  });
  it('rejects minors, out-of-range bodies and unknown restrictions', () => {
    expect(bodySchema.safeParse({ ...ok, age: 17 }).success).toBe(false);
    expect(bodySchema.safeParse({ ...ok, height: 300 }).success).toBe(false);
    expect(bodySchema.safeParse({ ...ok, restrictions: ['keto'] }).success).toBe(false);
  });
  it('validates target ranges', () => {
    expect(targetsSchema.safeParse({ kcal: 2000, p: 80, c: 250, f: 60, water: 2500 }).success).toBe(true);
    expect(targetsSchema.safeParse({ kcal: 700, p: 80, c: 250, f: 60, water: 2500 }).success).toBe(false);
    expect(targetsSchema.safeParse({ kcal: 2000, p: 80, c: 250, f: 60, water: 7000 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ok, targets: { kcal: 2000, p: 80, c: 0, f: 60, water: 2500 } }).success).toBe(true);
  });
  it('gives inline range errors', () => {
    expect(rangeError('', 18, 100, 'Age', 'years')).toBe('Enter age');
    expect(rangeError('17', 18, 100, 'Age', 'years')).toBe('Age: 18–100 years');
    expect(rangeError('30.5', 18, 100, 'Age', 'years', { int: true })).toBe('Age: use a whole number');
    expect(rangeError('30', 18, 100, 'Age', 'years')).toBe('');
  });
});

describe('dayTimeline', () => {
  const clock = clockIn('Asia/Kolkata');
  const food = SEED_FOODS.find(f => f.id === 'oats')!;
  const entry = (meal: Meal, created_at: string) => ({ meal, food, quantity: 1, created_at });
  const workout = (id: string, start_time: string | null, created_at: string, extra: Partial<WorkoutRow> = {}) => ({
    id, day: '2026-10-15', label: id, minutes: 30, kcal: 200, source: 'manual' as const, start_time, created_at, hidden: false, ...extra,
  });

  it('orders meals and workouts by time, using a workout’s start time over when it was logged', () => {
    const items = dayTimeline('2026-10-15', [
      entry('Breakfast', '2026-10-15T02:50:00Z'), // 8:20 IST
      entry('Lunch', '2026-10-15T07:15:00Z'), // 12:45 IST
    ], [
      workout('Run', '07:15:00', '2026-10-15T10:00:00Z'), // logged at 15:30 IST, ran at 7:15
    ], clock);
    expect(items.map(i => i.key)).toEqual(['workout-Run', 'meal-Breakfast', 'meal-Lunch']);
    expect(items[0]).toMatchObject({ at: 7 * 60 + 15, timed: 'start' });
    expect(items[1]).toMatchObject({ at: 8 * 60 + 20, timed: 'logged' });
  });

  it('places untimed workouts by when they were recorded', () => {
    const items = dayTimeline('2026-10-15', [entry('Lunch', '2026-10-15T07:15:00Z')], [
      workout('Class', null, '2026-10-15T12:30:00Z'), // 18:00 IST
      workout('Walk', null, '2026-10-15T03:30:00Z'), // 9:00 IST
    ], clock);
    expect(items.map(i => i.key)).toEqual(['workout-Walk', 'meal-Lunch', 'workout-Class']);
    expect(items[0]).toMatchObject({ timed: 'logged', at: 9 * 60 });
  });

  it('uses the usual time for meals logged on another day, and skips hidden or other-day workouts', () => {
    const items = dayTimeline('2026-10-15', [
      entry('Dinner', '2026-10-16T04:00:00Z'), // back-filled next morning
      entry('Breakfast', '2026-10-16T04:01:00Z'),
    ], [
      workout('Hidden', '06:00', '2026-10-15T01:00:00Z', { hidden: true }),
      workout('Yesterday', '06:00', '2026-10-14T01:00:00Z', { day: '2026-10-14' }),
    ], clock);
    expect(items.map(i => [i.key, i.at])).toEqual([['meal-Breakfast', USUAL_MEAL_MINUTES.Breakfast], ['meal-Dinner', USUAL_MEAL_MINUTES.Dinner]]);
    expect(items.every(i => i.kind === 'meal' && i.timed === 'usual')).toBe(true);
  });

  it('puts a workout before a meal at the same minute, and labels times on a 12-hour clock', () => {
    const items = dayTimeline('2026-10-15', [entry('Breakfast', '2026-10-15T02:30:00Z')], [workout('Yoga', '08:00', '2026-10-15T01:00:00Z')], clock);
    expect(items.map(i => i.kind)).toEqual(['workout', 'meal']);
    expect(clockLabel(8 * 60)).toBe('8:00 AM');
    expect(clockLabel(0)).toBe('12:00 AM');
    expect(clockLabel(12 * 60 + 5)).toBe('12:05 PM');
    expect(parseClock('7:5')).toBeNull();
  });
});

describe('workoutWeek', () => {
  it('totals sessions, minutes and kcal per day and for the week, ignoring hidden and out-of-week workouts', () => {
    const keys = weekKeys('2026-10-15');
    const w = (day: string, minutes: number, kcal: number, source: 'manual' | 'strava' = 'manual', hidden = false) => ({ day, minutes, kcal, source, hidden });
    const week = workoutWeek(keys, [
      w('2026-10-15', 30, 250), w('2026-10-15', 45, 400, 'strava'), w('2026-10-11', 60, 300, 'strava'),
      w('2026-10-12', 20, 150, 'manual', true), w('2026-10-01', 90, 900),
    ]);
    expect(week.days).toHaveLength(7);
    expect(week.days[6]).toEqual({ day: '2026-10-15', workouts: 2, minutes: 75, kcal: 650 });
    expect(week.days.find(d => d.day === '2026-10-12')).toMatchObject({ workouts: 0, kcal: 0 });
    expect(week).toMatchObject({ sessions: 3, minutes: 135, kcal: 950, bySource: { manual: 1, strava: 2 } });
  });
  it('an empty week is all zeros', () => {
    expect(workoutWeek(weekKeys('2026-10-15'), [])).toMatchObject({ sessions: 0, minutes: 0, kcal: 0 });
  });
});
