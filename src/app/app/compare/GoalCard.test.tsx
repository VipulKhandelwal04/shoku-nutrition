import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@/components/app/insights/actions', () => ({ setGoal: vi.fn(), saveTargets: vi.fn(), applyRecommendedTargets: vi.fn() }));
import { GoalCard } from './GoalCard';
import { ToastProvider } from '@/components/ui/Toast';
const props = { goal: 'lose' as const, targets: { kcal: 2000, p: 100, c: 250, f: 67, water: 2500 }, recommended: { kcal: 2000, p: 100, c: 250, f: 67, water: 2500 }, bmi: null, bmiNote: null, body: null, logged: { kcal: 840, p: 35, c: 90, f: 30, fibre: 10 }, loggedLabel: 'Logged', waterLogged: 600, periodNote: 'Logged today.' };
it('compares targets with actual logs rather than repeating the recommendation', () => {
  const html = renderToStaticMarkup(createElement(ToastProvider, null, createElement(GoalCard, props)));
  expect(html).toContain('Daily target');
  expect(html).toContain('Logged');
  expect(html).toContain('840');
  expect(html).toContain('600');
  expect(html).not.toContain('Your targets match this goal');
});
it('distinguishes missing logs from measured intake and identifies target overrides', () => {
  const html = renderToStaticMarkup(createElement(ToastProvider, null, createElement(GoalCard, { ...props, logged: null, waterLogged: null, recommended: { ...props.recommended, kcal: 1800 } })));
  expect(html).toContain('Custom or earlier targets active');
  expect(html).toContain('—');
  expect(html).toContain('Use recommended targets');
});
