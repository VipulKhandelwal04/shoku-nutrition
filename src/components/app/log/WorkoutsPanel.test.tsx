import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/data/workouts', () => ({}));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => vi.fn() }));
import { WorkoutsPanel, type WorkoutsData } from './WorkoutsPanel';
const data: WorkoutsData = {
  workouts: [], manual: true, lightBase: true, timeline: true, week: true,
  strava: { configured: false, connection: null }, weightKg: 70, activity: 'light',
};
describe('discovering fitness activity', () => {
  it('explains fitness-app availability instead of hiding the connection', () => {
    const html = renderToStaticMarkup(createElement(WorkoutsPanel, { day: '2026-10-16', isToday: true, data }));
    expect(html).toContain('Fitness apps');
    expect(html).toContain('Strava');
    expect(html).toContain('unavailable');
    expect(html).not.toContain('href="/api/strava/connect"');
    expect(html).toContain('Log a workout');
  });
});
