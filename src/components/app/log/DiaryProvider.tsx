'use client';
import { createContext, startTransition, useCallback, useContext, useMemo, useOptimistic, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/components/ui/Toast';
import { addEntries, changeWater, deleteEntries, repeatMeal, setDayDone, updateEntry } from '@/lib/data/diary';
import { BADGES, shiftDate, totals, type Food, type Meal, type Targets } from '@/lib/nutrition';
import type { DayRow, EntryRow, EntrySource } from '@/lib/types';
import { dec } from './clientDate';
import { LogSheets } from './LogSheets';

type Op =
  | { t: 'add'; entries: EntryRow[] }
  | { t: 'remove'; ids: string[] }
  | { t: 'update'; id: string; quantity: number; meal: Meal };

function reduce(state: EntryRow[], op: Op): EntryRow[] {
  if (op.t === 'add') return [...state, ...op.entries];
  if (op.t === 'remove') return state.filter(e => !op.ids.includes(e.id));
  return state.map(e => (e.id === op.id ? { ...e, quantity: op.quantity, meal: op.meal } : e));
}

export type SheetView =
  | { kind: 'search'; meal: Meal; frequent: string[] }
  | { kind: 'portion'; food: Food; meal: Meal; entry?: EntryRow; back?: 'search' | 'custom' }
  | { kind: 'custom'; meal: Meal; name: string };

export const isTemp = (id: string) => id.startsWith('tmp-');

const focusLost = () => !document.activeElement || document.activeElement === document.body;
const usable = (el: HTMLElement | null | undefined): el is HTMLElement =>
  !!el && el.isConnected && !el.closest('dialog:not([open])') && !el.closest('[hidden]');

/**
 * Moves focus deliberately once the DOM settles, but only if focus was lost (the focused control was removed,
 * or a toast/sheet closed). Prefers the control the user originally pressed, then the `data-focus` fallback.
 */
export function focusKey(key: string, delay = 80, origin?: HTMLElement | null) {
  setTimeout(() => {
    if (!focusLost()) return;
    const el = usable(origin) ? origin : document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`);
    el?.focus();
  }, delay);
}

const activeEl = () => (document.activeElement instanceof HTMLElement ? document.activeElement : null);

const portionLabel = (food: Food, quantity: number) => `${dec(quantity)} ${food.unit} ${food.name.split(',')[0]}`;

type Ctx = {
  day: string;
  today: string;
  isToday: boolean;
  foods: Food[];
  foodsById: Map<string, Food>;
  frequentIds: string[];
  targets: Targets;
  entries: EntryRow[];
  yesterdayEntries: EntryRow[];
  mealsByDay: Record<string, number>;
  water: number;
  done: boolean;
  expanded: ReadonlySet<Meal>;
  toggleMeal: (meal: Meal) => void;
  openSearch: (meal: Meal) => void;
  openPortion: (food: Food, meal: Meal) => void;
  openEntry: (entry: EntryRow) => void;
  quickAdd: (food: Food, meal: Meal) => void;
  addPortion: (food: Food, meal: Meal, quantity: number) => void;
  editEntry: (entry: EntryRow, quantity: number, meal: Meal) => void;
  removeEntry: (entry: EntryRow, focusAfter?: string) => void;
  repeat: (meal: Meal) => void;
  addWater: (deltaMl: number) => void;
  toggleDone: () => void;
  /** AI Assist saved entries itself: offer Undo and expand the meal. */
  aiLogged: (ids: string[], meal: Meal) => void;
};

const DiaryContext = createContext<Ctx | null>(null);

export function useDiary(): Ctx {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error('useDiary must be used inside <DiaryProvider>');
  return ctx;
}

export function DiaryProvider({ day, today, foods, frequentIds, targets, entries: baseEntries, days, mealsByDay: baseMealsByDay, defaultExpanded = [], children }: {
  day: string;
  today: string;
  foods: Food[];
  frequentIds: string[];
  targets: Targets;
  entries: EntryRow[];
  days: DayRow[];
  mealsByDay: Record<string, number>;
  defaultExpanded?: Meal[];
  children: ReactNode;
}) {
  const toast = useToast();
  const [all, applyOp] = useOptimistic(baseEntries, reduce);
  const baseDay = days.find(d => d.day === day);
  const [water, addOptimisticWater] = useOptimistic(baseDay?.water_ml ?? 0, (w: number, delta: number) => Math.min(15000, Math.max(0, w + delta)));
  const [done, setOptimisticDone] = useOptimistic(baseDay?.done ?? false, (_: boolean, v: boolean) => v);
  const [expanded, setExpanded] = useState<Set<Meal>>(() => new Set(defaultExpanded));
  const [view, setView] = useState<SheetView | null>(null);
  const waterQueue = useRef<Promise<unknown>>(Promise.resolve());

  const foodsById = useMemo(() => new Map(foods.map(f => [f.id, f])), [foods]);
  const entries = useMemo(() => all.filter(e => e.day === day), [all, day]);
  const yesterday = shiftDate(day, -1);
  const yesterdayEntries = useMemo(() => all.filter(e => e.day === yesterday), [all, yesterday]);
  const mealsByDay = useMemo(() => {
    const n = new Set(entries.map(e => e.meal)).size;
    const next = { ...baseMealsByDay };
    if (n) next[day] = n; else delete next[day];
    return next;
  }, [baseMealsByDay, entries, day]);

  const expand = useCallback((meal: Meal) => setExpanded(s => (s.has(meal) ? s : new Set(s).add(meal))), []);
  const toggleMeal = useCallback((meal: Meal) => setExpanded(s => {
    const n = new Set(s);
    if (n.has(meal)) n.delete(meal); else n.add(meal);
    return n;
  }), []);

  const undoAdd = useCallback((ids: string[], meal: Meal, origin?: HTMLElement | null) => {
    startTransition(async () => {
      applyOp({ t: 'remove', ids });
      const r = await deleteEntries(ids);
      if (!r.ok) toast(r.error);
    });
    focusKey(`add-${meal}`, 120, origin);
  }, [applyOp, toast]);

  const logItems = useCallback((items: { food: Food; foodId: string; meal: Meal; quantity: number }[], source: EntrySource, message: string) => {
    const now = new Date().toISOString();
    const temp: EntryRow[] = items.map(i => ({
      id: `tmp-${crypto.randomUUID()}`, user_id: '', day, meal: i.meal, food_id: i.foodId, food: i.food, quantity: i.quantity, photo_path: null, source, created_at: now,
    }));
    // Show the new item right away, before (and independent of) the server round trip.
    for (const i of items) expand(i.meal);
    const meal = items[0].meal;
    const origin = activeEl();
    startTransition(async () => {
      applyOp({ t: 'add', entries: temp });
      const r = await addEntries({ day, items: items.map(i => ({ meal: i.meal, foodId: i.foodId, quantity: i.quantity, source })) });
      if (!r.ok) { toast(r.error); return; }
      const ids = r.data.ids;
      const badge = [...BADGES].reverse().find(b => r.data.newBadges.includes(b.id));
      if (badge) toast(`${badge.name} unlocked`, { tone: 'win', undo: () => undoAdd(ids, meal, origin) });
      else toast(message, { undo: () => undoAdd(ids, meal, origin) });
    });
  }, [applyOp, day, expand, toast, undoAdd]);

  const quickAdd = useCallback((food: Food, meal: Meal) => {
    logItems([{ food, foodId: food.id, meal, quantity: 1 }], 'quick', `Added ${portionLabel(food, 1)} to ${meal.toLowerCase()}.`);
  }, [logItems]);

  const addPortion = useCallback((food: Food, meal: Meal, quantity: number) => {
    // The sheet returns focus to whatever opened it (still mounted), so no focus move is needed here.
    logItems([{ food, foodId: food.id, meal, quantity }], 'manual', `Added ${portionLabel(food, quantity)} to ${meal.toLowerCase()}.`);
  }, [logItems]);

  const editEntry = useCallback((entry: EntryRow, quantity: number, meal: Meal) => {
    expand(meal);
    startTransition(async () => {
      applyOp({ t: 'update', id: entry.id, quantity, meal });
      const r = await updateEntry({ id: entry.id, quantity, meal });
      toast(r.ok ? `Updated ${entry.food.name.split(',')[0]}.` : r.error);
    });
    focusKey(`item-${entry.id}`, 160);
  }, [applyOp, expand, toast]);

  const removeEntry = useCallback((entry: EntryRow, focusAfter?: string) => {
    const name = entry.food.name.split(',')[0];
    startTransition(async () => {
      applyOp({ t: 'remove', ids: [entry.id] });
      const r = await deleteEntries([entry.id]);
      if (!r.ok) { toast(r.error); return; }
      const foodId = entry.food_id;
      toast(`Removed ${name}.`, foodId ? {
        undo: () => logItems([{ food: entry.food, foodId, meal: entry.meal, quantity: entry.quantity }], entry.source, `${name} is back.`),
      } : undefined);
    });
    focusKey(focusAfter ?? `add-${entry.meal}`, 160);
  }, [applyOp, logItems, toast]);

  const repeat = useCallback((meal: Meal) => {
    const src = yesterdayEntries.filter(e => e.meal === meal);
    if (!src.length) return;
    const now = new Date().toISOString();
    const temp: EntryRow[] = src.map(e => ({ ...e, id: `tmp-${crypto.randomUUID()}`, day, source: 'repeat', created_at: now }));
    expand(meal);
    const kcal = Math.round(totals(src).kcal);
    startTransition(async () => {
      applyOp({ t: 'add', entries: temp });
      const r = await repeatMeal({ fromDay: yesterday, toDay: day, meal });
      if (!r.ok) { toast(r.error); return; }
      const ids = r.data.ids;
      const badge = [...BADGES].reverse().find(b => r.data.newBadges.includes(b.id));
      if (badge) toast(`${badge.name} unlocked`, { tone: 'win', undo: () => undoAdd(ids, meal) });
      else toast(`Repeated ${meal.toLowerCase()} · ${kcal} kcal.`, { undo: () => undoAdd(ids, meal) });
    });
    // The repeat chip disappears once the meal has items: keep focus on the meal.
    focusKey(`add-${meal}`);
  }, [applyOp, day, expand, toast, undoAdd, yesterday, yesterdayEntries]);

  const addWater = useCallback((deltaMl: number) => {
    startTransition(async () => {
      addOptimisticWater(deltaMl);
      // Serialise taps: the action reads then writes, so parallel calls could drop a glass.
      const run = waterQueue.current.then(() => changeWater({ day, deltaMl }));
      waterQueue.current = run.catch(() => undefined);
      const r = await run;
      if (!r.ok) toast(r.error);
    });
  }, [addOptimisticWater, day, toast]);

  const toggleDone = useCallback(() => {
    const next = !done;
    startTransition(async () => {
      setOptimisticDone(next);
      const r = await setDayDone({ day, done: next });
      if (!r.ok) toast(r.error);
      else toast(next ? 'Day closed. Nice work.' : 'Day reopened. Keep logging.');
    });
  }, [day, done, setOptimisticDone, toast]);

  const aiLogged = useCallback((ids: string[], meal: Meal) => {
    if (!ids.length) return;
    // AiLogSheet shows the toast (its Undo also removes a saved photo); here we only open the meal.
    expand(meal);
  }, [expand]);

  const openSearch = useCallback((meal: Meal) => setView({ kind: 'search', meal, frequent: frequentIds }), [frequentIds]);
  const openPortion = useCallback((food: Food, meal: Meal) => setView({ kind: 'portion', food, meal }), []);
  const openEntry = useCallback((entry: EntryRow) => {
    if (isTemp(entry.id)) return;
    setView({ kind: 'portion', food: entry.food, meal: entry.meal, entry });
  }, []);

  const value: Ctx = {
    day, today, isToday: day === today, foods, foodsById, frequentIds, targets, entries, yesterdayEntries, mealsByDay, water, done,
    expanded, toggleMeal, openSearch, openPortion, openEntry, quickAdd, addPortion, editEntry, removeEntry, repeat, addWater, toggleDone, aiLogged,
  };

  return (
    <DiaryContext.Provider value={value}>
      {children}
      <LogSheets view={view} setView={setView} />
    </DiaryContext.Provider>
  );
}
