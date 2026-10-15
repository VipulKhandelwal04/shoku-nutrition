import type { EntryRow, WorkoutRow } from './types';

export type EnergyDay = {
  day: string;
  intake: number | null;
  burned: number | null;
  meals: number;
  sessions: number;
  minutes: number;
  imported: number;
};

/** Recorded intake and workout energy for the same calendar days. Missing logs are not zero expenditure.
 * Includes partial food days; streak eligibility and the 50% target credit do not apply to this comparison.
 */
export function activityEnergy(days: string[], entries: Pick<EntryRow, 'day' | 'meal' | 'food' | 'quantity'>[], workouts: Pick<WorkoutRow, 'day' | 'kcal' | 'minutes' | 'hidden' | 'source'>[]): EnergyDay[] {
  return days.map(day => {
    const food = entries.filter(e => e.day === day);
    const activity = workouts.filter(w => w.day === day && !w.hidden);
    return {
      day,
      intake: food.length ? food.reduce((sum, e) => sum + e.food.kcal * e.quantity, 0) : null,
      burned: activity.length ? activity.reduce((sum, w) => sum + w.kcal, 0) : null,
      meals: new Set(food.map(e => e.meal)).size,
      sessions: activity.length,
      minutes: activity.reduce((sum, w) => sum + w.minutes, 0),
      imported: activity.filter(w => w.source === 'strava').length,
    };
  });
}
