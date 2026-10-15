import { describe, expect, it } from 'vitest';
import { EMPTY_FEEDBACK, MAX_LIKED_MEALS, feedbackSummary } from './feedback';

const row = (rating: 'like' | 'okay' | 'no', food_ids: string[], title = 'Meal', created_at = '2026-10-15T08:00:00Z') => ({ rating, food_ids, title, created_at });

describe('feedbackSummary', () => {
  it('likes raise a food above 1 and "not for me" lowers it below 1', () => {
    const f = feedbackSummary([row('like', ['paneer']), row('no', ['poha'])]).factor;
    expect(f.get('paneer')).toBeGreaterThan(1);
    expect(f.get('poha')).toBeLessThan(1);
    expect(f.get('poha')).toBeGreaterThan(0); // pushed down, never zeroed out
  });

  it('"okay", and opinions that cancel out, leave a food neutral', () => {
    const f = feedbackSummary([row('okay', ['dal']), row('like', ['roti']), row('no', ['roti'])]).factor;
    expect(f.has('dal')).toBe(false);
    expect(f.has('roti')).toBe(false);
  });

  it('caps the effect so repeated ratings cannot dominate or vanish a food', () => {
    const many = Array.from({ length: 20 }, () => row('no', ['poha']));
    const f = feedbackSummary([...many, ...Array.from({ length: 20 }, () => row('like', ['egg']))]).factor;
    expect(f.get('poha')).toBeGreaterThanOrEqual(0.4);
    expect(f.get('egg')).toBeLessThanOrEqual(1.75);
  });

  it('lists liked meal titles newest first, without repeats, up to the limit', () => {
    const rows = [
      row('like', ['a'], 'Paneer bhurji', '2026-10-10T08:00:00Z'),
      row('like', ['b'], 'Dal chawal', '2026-10-14T08:00:00Z'),
      row('like', ['c'], 'Paneer bhurji', '2026-10-12T08:00:00Z'),
      row('no', ['d'], 'Poha', '2026-10-15T08:00:00Z'),
      ...Array.from({ length: 8 }, (_, i) => row('like', ['e'], `Meal ${i}`, '2026-01-01T00:00:00Z')),
    ];
    const liked = feedbackSummary(rows).likedMeals;
    expect(liked.slice(0, 2)).toEqual(['Dal chawal', 'Paneer bhurji']);
    expect(liked).not.toContain('Poha');
    expect(liked.length).toBe(MAX_LIKED_MEALS);
  });

  it('no ratings means no signal', () => {
    expect(feedbackSummary([])).toEqual(EMPTY_FEEDBACK);
  });
});
