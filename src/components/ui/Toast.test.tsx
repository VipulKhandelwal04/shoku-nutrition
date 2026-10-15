// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type UndoResult } from './Toast';

let root: Root;
let container: HTMLDivElement;
let notify: ReturnType<typeof useToast>;
function Harness() { const show = useToast(); useEffect(() => { notify = show; }, [show]); return null; }
const buttons = () => [...document.querySelectorAll('button')];
const undoButton = () => buttons().find(b => b.textContent === 'Undo')!;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ToastProvider><Harness /></ToastProvider>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('recovery notifications', () => {
  it('preserves Undo beyond the former deadline and subsequent messages', async () => {
    await act(async () => notify('Removed lunch.', { undo: async () => ({ ok: true }) }));
    await act(async () => notify('Water added.'));
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(document.body.textContent).toContain('Removed lunch.');
    expect(document.body.textContent).not.toContain('Water added.');
    expect(undoButton()).toBeTruthy();
  });
  it('keeps failure visible and permits retry; only announces confirmed success', async () => {
    const undo = vi.fn<() => Promise<UndoResult>>().mockResolvedValueOnce({ ok: false, error: 'Restore failed.' }).mockResolvedValueOnce({ ok: true });
    await act(async () => notify('Removed workout.', { undo }));
    await act(async () => undoButton().click());
    expect(document.body.textContent).toContain('Restore failed.');
    expect(document.body.textContent).not.toContain('Undone.');
    await act(async () => undoButton().click());
    expect(document.body.textContent).toContain('Undone.');
    expect(undoButton()).toBeUndefined();
  });
  it('catches network exceptions without discarding the recovery action', async () => {
    await act(async () => notify('Removed meal.', { undo: async () => { throw new Error('Offline'); } }));
    await act(async () => undoButton().click());
    expect(document.body.textContent).toContain('Check your connection');
    expect(undoButton()).toBeTruthy();
  });
  it('prevents duplicate recovery requests while awaiting a result', async () => {
    let resolve!: (value: UndoResult) => void;
    const undo = vi.fn(() => new Promise<UndoResult>(r => { resolve = r; }));
    await act(async () => notify('Removed meal.', { undo }));
    const button = undoButton();
    await act(async () => { button.click(); button.click(); });
    expect(undo).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true }));
  });
});
