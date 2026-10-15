import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('Strava activity → workout', () => {
  it('uses Strava calories when present', async () => {
    const { toWorkout } = await import('./strava');
    const w = toWorkout({ id: 1, name: 'Morning Run', sport_type: 'Run', moving_time: 1800, start_date_local: '2026-10-15T06:30:00Z', calories: 410 }, 70);
    expect(w).toMatchObject({ day: '2026-10-15', start_time: '06:30', sport: 'run', minutes: 30, kcal: 410, kcal_source: 'device', external_id: '1' });
  });
  it('uses ride kilojoules as kcal when calories are missing', async () => {
    const { toWorkout } = await import('./strava');
    expect(toWorkout({ id: 2, name: 'Ride', sport_type: 'Ride', moving_time: 3600, start_date_local: '2026-10-14T18:00:00Z', kilojoules: 620 }, 70))
      .toMatchObject({ sport: 'cycle', kcal: 620, kcal_source: 'device' });
  });
  it('falls back to a MET estimate, and unknown sports become "other"', async () => {
    const { toWorkout } = await import('./strava');
    // Yoga MET 3: (3 − 1) × 60 kg × 1 h = 120
    expect(toWorkout({ id: 3, name: 'Flow', sport_type: 'Yoga', moving_time: 3600, start_date_local: '2026-10-13T07:00:00Z' }, 60))
      .toMatchObject({ sport: 'yoga', kcal: 120, kcal_source: 'estimate' });
    expect(toWorkout({ id: 4, name: '', sport_type: 'Kitesurf', moving_time: 600, start_date_local: '2026-10-13T07:00:00Z' }, 60))
      .toMatchObject({ sport: 'other', label: 'Strava activity' });
  });
});
