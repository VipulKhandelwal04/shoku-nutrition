import { describe, expect, it } from 'vitest';
import { activityEnergy } from './activity-energy';
import { SEED_FOODS } from './seed-foods';
const food = SEED_FOODS[0];
const day = '2026-10-16';
const entry = { day, meal: 'Breakfast' as const, food, quantity: 2 };
const workout = { day, kcal: 400, minutes: 40, hidden: false, source: 'strava' as const };
describe('intake versus recorded workout calories', () => {
  it('includes a partially logged food day and compares full workout energy, not target credit', () => {
    expect(activityEnergy([day], [entry], [workout])[0]).toMatchObject({ intake: food.kcal * 2, burned: 400, meals: 1, imported: 1 });
  });
  it('uses the same date window for both series and ignores hidden workouts', () => {
    expect(activityEnergy([day], [{ ...entry, day: '2026-10-15' }], [workout, { ...workout, hidden: true }, { ...workout, day: '2026-10-17' }])[0])
      .toMatchObject({ intake: null, burned: 400, sessions: 1 });
  });
  it('distinguishes no logs from a recorded zero and retains days without meals', () => {
    const rows = activityEnergy(['2026-10-15', day], [], [{ ...workout, kcal: 0 }]);
    expect(rows[0]).toMatchObject({ intake: null, burned: null });
    expect(rows[1]).toMatchObject({ intake: null, burned: 0, sessions: 1 });
  });
  it('sums manual and imported activity without removing either source', () => {
    expect(activityEnergy([day], [entry], [workout, { ...workout, source: 'manual' }])[0]).toMatchObject({ burned: 800, minutes: 80, sessions: 2, imported: 1 });
  });
});
