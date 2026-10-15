import { describe, expect, it } from 'vitest';
import { addDays, istToday, matchesUser, nextSort, reorder, summarizeUsers, usageByDay, type UserStatRow } from './stats';

const user = (o: Partial<UserStatRow>): UserStatRow => ({
  id: crypto.randomUUID(), email: 'a@b.in', display_name: 'Asha', role: 'user', disabled: false, created_at: '2026-10-01T00:00:00Z',
  onboarded_at: null, last_logged: null, days_logged_30d: 0, ai_calls_today: 0, ...o,
});

describe('dates', () => {
  it('uses the India day boundary', () => {
    expect(istToday(new Date('2026-10-14T18:29:00Z'))).toBe('2026-10-14');
    expect(istToday(new Date('2026-10-14T18:31:00Z'))).toBe('2026-10-15');
  });
  it('adds days across months', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
});

describe('summarizeUsers', () => {
  it('counts onboarded, active in 7 days, admins and paused', () => {
    const s = summarizeUsers([
      user({ onboarded_at: '2026-10-02T00:00:00Z', last_logged: '2026-10-15' }),
      user({ onboarded_at: '2026-10-02T00:00:00Z', last_logged: '2026-10-09' }),
      user({ last_logged: '2026-10-08', role: 'admin' }),
      user({ disabled: true, role: 'admin' }),
    ], '2026-10-15');
    expect(s).toEqual({ users: 4, onboarded: 2, active7d: 2, admins: 1, paused: 1 });
  });
  it('handles an empty deployment', () => {
    expect(summarizeUsers([], '2026-10-15')).toEqual({ users: 0, onboarded: 0, active7d: 0, admins: 0, paused: 0 });
  });
});

describe('usageByDay', () => {
  it('zero-fills days and sums features', () => {
    const d = usageByDay([
      { day: '2026-10-15', feature: 'photo', calls: 4, failures: 1 },
      { day: '2026-10-15', feature: 'text', calls: 2, failures: 0 },
      { day: '2026-10-13', feature: 'coach', calls: 1, failures: 0 },
      { day: '2026-09-01', feature: 'coach', calls: 9, failures: 9 },
    ], '2026-10-15', 3);
    expect(d.map(x => x.day)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(d[2]).toEqual({ day: '2026-10-15', calls: 6, failures: 1, byFeature: { photo: 4, text: 2 } });
    expect(d[1].calls).toBe(0);
  });
});

describe('reorder', () => {
  const rows = [{ id: 1, sort: 1 }, { id: 2, sort: 2 }, { id: 3, sort: 3 }];
  it('swaps with the neighbour', () => {
    expect(reorder(rows, 3, 'up')).toEqual([{ id: 3, sort: 2 }, { id: 2, sort: 3 }]);
  });
  it('refuses moves past the ends', () => {
    expect(reorder(rows, 1, 'up')).toEqual([]);
    expect(reorder(rows, 3, 'down')).toEqual([]);
    expect(reorder(rows, 99, 'down')).toEqual([]);
  });
  it('settles duplicate sorts', () => {
    expect(reorder([{ id: 1, sort: 0 }, { id: 2, sort: 0 }], 1, 'down')).toEqual([{ id: 2, sort: 1 }, { id: 1, sort: 2 }]);
  });
  it('appends after the highest sort', () => {
    expect(nextSort(rows)).toBe(4);
    expect(nextSort([])).toBe(1);
  });
});

describe('matchesUser', () => {
  it('searches name and email case-insensitively', () => {
    expect(matchesUser({ display_name: 'Asha Rao', email: 'asha@x.in' }, 'RAO')).toBe(true);
    expect(matchesUser({ display_name: null, email: 'asha@x.in' }, 'x.in')).toBe(true);
    expect(matchesUser({ display_name: 'Asha', email: null }, 'ravi')).toBe(false);
  });
});
