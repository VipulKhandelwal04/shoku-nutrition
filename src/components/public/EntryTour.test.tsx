// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EntryTour } from './EntryTour';
const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth: signIn } }) }));
vi.mock('next/image', () => ({ default: (props: { src: string; alt: string }) => createElement('img', { src: props.src, alt: props.alt }) }));
const slides = [
  { id: 1, title: 'Log your meals', body: 'Your everyday food.', image_url: '/img/lunch.webp' },
  { id: 2, title: 'Know your balance', body: 'See your food groups.', image_url: '/img/dinner.webp' },
];
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.body.innerHTML = '<div id="test"></div>';
  root = createRoot(document.getElementById('test')!);
  signIn.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
const button = (name: string) => [...document.querySelectorAll('button')].find(el => el.textContent?.includes(name) || el.getAttribute('aria-label') === name)!;
it('keeps Google sign-in available throughout the tour and supports keyboard navigation', async () => {
  await act(async () => root.render(<EntryTour slides={slides} next="/app" error={null} />));
  expect(button('Continue with Google')).toBeTruthy();
  expect(button('Previous slide').disabled).toBe(true);
  await act(async () => button('Next slide').click());
  expect(document.querySelector('h1')?.textContent).toBe('Know your balance');
  expect(button('Next slide').disabled).toBe(true);
  expect(button('Continue with Google')).toBeTruthy();
  await act(async () => document.querySelector('[aria-roledescription="carousel"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
  expect(document.querySelector('h1')?.textContent).toBe('Log your meals');
});
it('opens Google through the existing callback and recovers from sign-in failure', async () => {
  signIn.mockResolvedValue({ error: new Error('offline') });
  await act(async () => root.render(<EntryTour slides={slides} next="/app/diary" error="Google sign-in didn’t finish. Try again." />));
  expect(document.body.textContent).toContain('Google sign-in didn’t finish');
  await act(async () => button('Continue with Google').click());
  expect(signIn).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fapp%2Fdiary` } });
  expect(document.body.textContent).toContain('Couldn’t reach Google sign-in');
  expect(button('Continue with Google').disabled).toBe(false);
  expect(document.querySelector('main')!.hasAttribute('data-opening-google')).toBe(false);
});
it('offers existing users their destination and falls back to the built-in tour', async () => {
  await act(async () => root.render(<EntryTour slides={[]} next="/app/diary" error={null} signedIn />));
  expect(document.querySelector('h1')?.textContent).toBe('Log a meal in seconds');
  expect(document.querySelector('a[href="/app/diary"]')?.textContent).toContain('Open Shoku');
  expect(button('Continue with Google')).toBeUndefined();
});
