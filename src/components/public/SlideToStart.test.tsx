// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { SlideToStart } from './SlideToStart';
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let root: Root;
let slider: HTMLElement;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); push.mockReset();
  document.body.innerHTML = '<div id="test"></div>';
  root = createRoot(document.getElementById('test')!);
  await act(async () => root.render(<SlideToStart />));
  slider = document.querySelector('[role="slider"]')!;
  Object.defineProperty(slider, 'offsetWidth', { value: 54 });
  Object.defineProperty(slider.parentElement, 'clientWidth', { value: 400 });
  slider.setPointerCapture = vi.fn();
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
async function pointer(type: string, x: number) {
  const event = new MouseEvent(type, { clientX: x, button: 0, bubbles: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  await act(async () => slider.dispatchEvent(event));
}
it('does not navigate on a track click, tap or partial drag', async () => {
  await act(async () => slider.parentElement!.click());
  await pointer('pointerdown', 20); await pointer('pointerup', 20);
  await pointer('pointerdown', 20); await pointer('pointermove', 120); await pointer('pointerup', 120);
  expect(push).not.toHaveBeenCalled(); expect(slider.getAttribute('aria-valuenow')).toBe('0');
});
it('navigates once only after reaching the checkmark and releasing', async () => {
  await pointer('pointerdown', 20); await pointer('pointermove', 354);
  expect(push).not.toHaveBeenCalled();
  await pointer('pointerup', 354); await pointer('pointerup', 354);
  expect(push).toHaveBeenCalledExactlyOnceWith('/login');
});
it('resets a cancelled drag even after reaching the end', async () => {
  await pointer('pointerdown', 20); await pointer('pointermove', 400); await pointer('pointercancel', 400);
  expect(push).not.toHaveBeenCalled(); expect(slider.getAttribute('aria-valuenow')).toBe('0');
});
it('supports keyboard completion without treating Enter or Space as a click-through', async () => {
  for (const key of ['Enter', ' ']) await act(async () => slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
  expect(push).not.toHaveBeenCalled();
  for (let n = 0; n < 9; n++) await act(async () => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(push).not.toHaveBeenCalled(); expect(slider.getAttribute('aria-valuenow')).toBe('90');
  await act(async () => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(push).toHaveBeenCalledExactlyOnceWith('/login');
});
