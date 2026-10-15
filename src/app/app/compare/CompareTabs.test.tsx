// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { CompareTabs } from './CompareTabs';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
const root = createRoot(container);
afterEach(() => act(() => root.render(null)));
it('keeps the overview separate from detailed panels and omits disabled features', async () => {
  await act(async () => root.render(createElement(CompareTabs, {
    initial: 'overview', overview: 'Summary', groups: null, nutrients: 'Nutrition details', plan: 'Meal plan',
  })));
  expect(container.querySelector('#cmp-overview')?.hasAttribute('hidden')).toBe(false);
  expect(container.querySelector('#cmp-plan')?.hasAttribute('hidden')).toBe(true);
  expect(container.querySelector('[aria-label="Food groups"]')).toBeNull();
  await act(async () => (container.querySelector('[aria-label="Plan"]') as HTMLButtonElement).click());
  expect(container.querySelector('#cmp-overview')?.hasAttribute('hidden')).toBe(true);
  expect(container.querySelector('#cmp-plan')?.hasAttribute('hidden')).toBe(false);
});
it('falls back to overview when a deep-linked feature is disabled', async () => {
  await act(async () => root.render(createElement(CompareTabs, {
    initial: 'plan', overview: 'Summary', groups: null, nutrients: null, plan: null,
  })));
  expect(container.querySelector('[aria-label="Overview"]')?.getAttribute('aria-pressed')).toBe('true');
});
