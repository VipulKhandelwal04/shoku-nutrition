// Pure aggregation helpers for the admin console. Inputs are rows from the admin_* SQL functions only.

export type UserStatRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'user' | 'admin';
  disabled: boolean;
  created_at: string;
  onboarded_at: string | null;
  last_logged: string | null; // YYYY-MM-DD
  days_logged_30d: number;
  ai_calls_today: number;
};

export type AiUsageRow = { day: string; feature: string; calls: number; failures: number };
export type UsageDay = { day: string; calls: number; failures: number; byFeature: Record<string, number> };

/** Today's date in India (YYYY-MM-DD), matching the SQL functions' Asia/Kolkata day boundary. */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function summarizeUsers(rows: UserStatRow[], today: string) {
  const weekStart = addDays(today, -6);
  return {
    users: rows.length,
    onboarded: rows.filter(r => r.onboarded_at).length,
    active7d: rows.filter(r => r.last_logged && r.last_logged >= weekStart && r.last_logged <= today).length,
    admins: rows.filter(r => r.role === 'admin' && !r.disabled).length,
    paused: rows.filter(r => r.disabled).length,
  };
}

/** One entry per day for the last `days` days (oldest first), zero-filled so the chart never has gaps. */
export function usageByDay(rows: AiUsageRow[], today: string, days: number): UsageDay[] {
  const out: UsageDay[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: addDays(today, -i), calls: 0, failures: 0, byFeature: {} });
  const index = new Map(out.map(d => [d.day, d]));
  for (const r of rows) {
    const d = index.get(String(r.day).slice(0, 10));
    if (!d) continue;
    d.calls += r.calls;
    d.failures += r.failures;
    d.byFeature[r.feature] = (d.byFeature[r.feature] ?? 0) + r.calls;
  }
  return out;
}

export function matchesUser(row: Pick<UserStatRow, 'email' | 'display_name'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (row.display_name ?? '').toLowerCase().includes(q) || (row.email ?? '').toLowerCase().includes(q);
}

/**
 * New sort values after moving `id` one step up or down. Renumbers 1..n so legacy duplicate sorts settle,
 * and returns only the rows whose sort changed. Empty when the move is not possible.
 */
export function reorder<T extends { id: number; sort: number }>(rows: T[], id: number, dir: 'up' | 'down'): { id: number; sort: number }[] {
  const list = [...rows].sort((a, b) => a.sort - b.sort || a.id - b.id);
  const i = list.findIndex(r => r.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return [];
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((r, k) => ({ id: r.id, sort: k + 1, prev: r.sort })).filter(r => r.sort !== r.prev).map(({ id: rid, sort }) => ({ id: rid, sort }));
}

export function nextSort(rows: { sort: number }[]): number {
  return rows.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
}

/** "3 Oct" style, or `fallback` for null. Fixed time zones so server and client render the same text. */
export function shortDate(value: string | null, fallback = 'Never'): string {
  if (!value) return fallback;
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: value.length === 10 ? 'UTC' : 'Asia/Kolkata' });
}
