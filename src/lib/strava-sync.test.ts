import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
vi.mock('./supabase/strava-admin', () => ({ stravaAdmin: () => ({ rpc: state.rpc }) }));

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  stored: { access_token: 'test-token', refresh_token: 'test-refresh', expires_at: '2099-01-01', last_sync_at: null as string | null, sync_after: null as string | null, sync_before: null as string | null, sync_page: 1 },
}));

function harness(count: number, failId?: string) {
  const known = new Set<string>();
  const rows = Array.from({ length: count }, (_, i) => ({ id: i + 1, name: 'Run', moving_time: 1800, start_date_local: '2026-10-10T06:00:00Z', start_date: '2026-10-10T06:00:00Z' }));
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'connection_tokens_for_user') return { data: [state.stored], error: null };
    if (name === 'connection_sync_progress') {
      state.stored.sync_after = args.p_complete ? null : String(args.p_after);
      state.stored.sync_before = args.p_complete ? null : String(args.p_before);
      state.stored.sync_page = args.p_complete ? 1 : Number(args.p_page);
      if (args.p_complete) state.stored.last_sync_at = String(args.p_before);
    }
    return { data: null, error: null };
  });
  state.rpc = rpc;
  const db = {
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ in: async () => ({ data: [...known].map(external_id => ({ external_id })), error: null }) }) }),
      upsert: async (row: { external_id: string }) => {
        if (row.external_id === failId) return { error: { message: 'write failed' } };
        known.add(row.external_id); return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/athlete/activities')) {
      const after = Number(u.searchParams.get('after')) * 1000;
      const page = Number(u.searchParams.get('page') ?? 1);
      const eligible = rows.filter(r => Date.parse(r.start_date) > after);
      return Response.json(eligible.slice((page - 1) * 50, page * 50));
    }
    return Response.json(rows.find(r => u.pathname.endsWith(`/${r.id}`)));
  }));
  return { db, known, rpc };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T12:00:00Z')); state.stored.last_sync_at = null; state.stored.sync_after = null; state.stored.sync_before = null; state.stored.sync_page = 1; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('Strava backlog sync', () => {
  it('imports a backlog larger than one batch without skipping older activities', async () => {
    const { sync } = await import('./strava');
    const h = harness(16);
    await sync(h.db, 'member', 70, true);
    await sync(h.db, 'member', 70, true);
    expect(h.known.size).toBe(16);
    expect(state.stored.last_sync_at).not.toBeNull();
  });
  it('resumes paginated imports beyond the first 50 activities', async () => {
    const { sync } = await import('./strava');
    const h = harness(61);
    for (let i = 0; i < 5; i++) await sync(h.db, 'member', 70, true);
    expect(h.known.size).toBe(61);
    expect(state.stored.last_sync_at).not.toBeNull();
  });
  it('preserves the original window across long delayed retries', async () => {
    const { sync } = await import('./strava');
    const h = harness(16);
    await sync(h.db, 'member', 70, true);
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
    await sync(h.db, 'member', 70, true);
    expect(h.known.size).toBe(16);
  });
  it('does not advance the watermark past a failed database write', async () => {
    const { sync } = await import('./strava');
    const h = harness(1, '1');
    await sync(h.db, 'member', 70, true).catch(() => undefined);
    expect(state.stored.last_sync_at).toBeNull();
  });
});
