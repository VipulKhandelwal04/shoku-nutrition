import 'server-only';
import { getDays, getEntries, getFoods, getMealsByDay } from '@/lib/data/queries';
import { shiftDate } from '@/lib/nutrition';
import type { DayRow, EntryRow, FoodRow } from '@/lib/types';

/** Users are in India: the server's best guess of "today" before the browser's own date takes over. */
const IST = 'Asia/Kolkata';

function istToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function istHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', hourCycle: 'h23' }).format(now)) % 24;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDay(v: string): boolean {
  if (!DAY_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type DiaryWindow = {
  /** Server guess of today (IST). The client replaces it with its own local date after hydration. */
  serverToday: string;
  serverHour: number;
  /** ?day=YYYY-MM-DD when valid and not clearly in the future; null means "today" (client decides). */
  requestedDay: string | null;
  foods: FoodRow[];
  /** Entries from 30 days before the anchor through the day after (covers today, yesterday and usuals). */
  entries: EntryRow[];
  days: DayRow[];
  mealsByDay: Record<string, number>;
  /** Food ids by how often they were logged in the window, most frequent first. */
  frequentIds: string[];
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Everything the Today and Diary screens need for one day, read as the signed-in user (RLS applies). */
export async function loadDiaryWindow(searchParams: Record<string, string | string[] | undefined>): Promise<DiaryWindow> {
  const now = new Date();
  const serverToday = istToday(now);
  const raw = firstParam(searchParams.day);
  // Allow one day of slack for time zones ahead of India; the client rejects anything past its own today.
  const requestedDay = raw && validDay(raw) && raw <= shiftDate(serverToday, 1) ? raw : null;
  const anchor = requestedDay ?? serverToday;

  const [foods, entries, days, mealsByDay] = await Promise.all([
    getFoods(),
    getEntries(shiftDate(anchor, -30), shiftDate(anchor, 1)),
    getDays(shiftDate(anchor, -2), shiftDate(anchor, 1)),
    getMealsByDay(shiftDate(anchor, 1)),
  ]);

  const counts = new Map<string, number>();
  for (const e of entries) if (e.food_id) counts.set(e.food_id, (counts.get(e.food_id) ?? 0) + 1);
  const frequentIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  return {
    serverToday,
    serverHour: istHour(now),
    requestedDay,
    foods,
    entries: entries.map(e => ({ ...e, quantity: Number(e.quantity) })),
    days,
    mealsByDay,
    frequentIds,
  };
}
