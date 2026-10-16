// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OnboardingFlow, type Draft } from './OnboardingFlow';
vi.mock('./actions', () => ({ completeOnboarding: vi.fn() }));
vi.mock('next/image', () => ({ default: (props: { src: string; alt: string }) => createElement('img', { src: props.src, alt: props.alt }) }));
const initial: Draft = { goal: 'fit', sex: 'female', age: '30', height: '165', weight: '60', activity: 'moderate', diet: 'veg', restrictions: [], targets: null, basis: null };
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { cb(); return 0; });
  document.body.innerHTML = '<div id="test"></div>';
  root = createRoot(document.getElementById('test')!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
const next = async () => act(async () => { document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
it('uses a different full-screen cuisine for every step and retains the draft on Back', async () => {
  await act(async () => root.render(<OnboardingFlow firstName="Sam" initial={initial} />));
  const cuisines = ['indian', 'japanese', 'mediterranean', 'mexican', 'thai', 'italian'];
  for (let n = 0; n < cuisines.length; n++) {
    expect(document.querySelector('main')!.dataset.cuisine).toBe(cuisines[n]);
    expect(document.querySelector('img')!.getAttribute('src')).toBe(`/img/onboarding/${cuisines[n]}.webp`);
    if (n < cuisines.length - 1) await next();
  }
  expect(document.body.textContent).toContain('Your daily targets');
  for (let n = 0; n < 3; n++) await act(async () => [...document.querySelectorAll('button')].find(el => el.textContent === 'Back')!.click());
  expect((document.getElementById('ob-age') as HTMLInputElement).value).toBe('30');
  expect(document.querySelector('main')!.dataset.cuisine).toBe('mediterranean');
});
it('keeps validation in place instead of advancing the background past an invalid step', async () => {
  await act(async () => root.render(<OnboardingFlow firstName={null} initial={{ ...initial, goal: null }} />));
  await next(); await next();
  expect(document.querySelector('main')!.dataset.cuisine).toBe('japanese');
  expect(document.body.textContent).toContain('Pick the goal that fits you best.');
});
