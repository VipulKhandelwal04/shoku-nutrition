// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { EnergyComparison } from './EnergyComparison';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
const root = createRoot(container);
afterEach(() => act(() => root.render(null)));
it('lets a keyboard-accessible day button reveal that day’s full values', async () => {
  await act(async () => root.render(createElement(EnergyComparison, { days: [
    { day: '2026-10-15', intake: 1800, burned: 450, meals: 2, sessions: 1, minutes: 40, imported: 1 },
    { day: '2026-10-16', intake: 1200, burned: null, meals: 1, sessions: 0, minutes: 0, imported: 0 },
  ] })));
  const first = container.querySelector('button')!;
  expect(first.getAttribute('aria-label')).toContain('450 kcal');
  await act(async () => first.click());
  expect(first.getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelector('[aria-live]')?.textContent).toContain('Workouts: 450 kcal');
  expect(container.textContent).toContain('not your total daily energy use');
});
it('explains missing records without presenting zero as measured expenditure', async () => {
  await act(async () => root.render(createElement(EnergyComparison, { days: [
    { day: '2026-10-16', intake: null, burned: null, meals: 0, sessions: 0, minutes: 0, imported: 0 },
  ] })));
  expect(container.textContent).toContain('No activity logged');
  expect(container.textContent).toContain('connect Strava or add a workout');
  expect(container.textContent).toContain('Not logged');
  expect(container.querySelector('button')).toBeNull();
});
