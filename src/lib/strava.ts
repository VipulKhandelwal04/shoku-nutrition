import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stravaAdmin } from './supabase/strava-admin';
import { WORKOUT_PRESETS, estimateBurn } from './nutrition';

// Strava connector: OAuth (web), token refresh, and importing recent activities as workouts.
// Tokens never reach the browser; they live in private.connections behind security-definer functions.

const OAUTH = 'https://www.strava.com/oauth';
const API = 'https://www.strava.com/api/v3';
export const STRAVA_SCOPE = 'read,activity:read_all';
export const STATE_COOKIE = 'shoku-strava-state';
const SYNC_EVERY_MS = 10 * 60 * 1000;
const FIRST_SYNC_DAYS = 14;
const MAX_NEW_PER_SYNC = 15;

function creds() {
  const id = process.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Strava is not configured');
  return { id, secret };
}

export function authorizeUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: creds().id, response_type: 'code', redirect_uri: `${origin}/api/strava/callback`,
    approval_prompt: 'auto', scope: STRAVA_SCOPE, state,
  });
  return `${OAUTH}/authorize?${q}`;
}

type TokenResponse = {
  access_token: string; refresh_token: string; expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = creds();
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}`);
  return res.json() as Promise<TokenResponse>;
}

/** Exchanges the OAuth code and stores the connection for the signed-in user. */
export async function connect(userId: string, code: string, grantedScope: string | null) {
  const t = await tokenRequest({ code, grant_type: 'authorization_code' });
  const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || null;
  const { error } = await stravaAdmin().rpc('connection_save_for_user', {
    p_user_id: userId,
    p_provider: 'strava', p_external_user_id: String(t.athlete?.id ?? ''), p_display_name: name,
    p_access_token: t.access_token, p_refresh_token: t.refresh_token,
    p_expires_at: new Date(t.expires_at * 1000).toISOString(), p_scope: grantedScope,
  });
  if (error) throw new Error('Could not save the Strava connection');
}

type Stored = { access_token: string; refresh_token: string; expires_at: string; last_sync_at: string | null; sync_after: string | null; sync_before: string | null; sync_page: number };

async function stored(userId: string): Promise<Stored | null> {
  const { data, error } = await stravaAdmin().rpc('connection_tokens_for_user', { p_user_id: userId, p_provider: 'strava' });
  if (error) throw new Error('Could not read the Strava connection');
  return (data?.[0] as Stored | undefined) ?? null;
}

/** A valid access token, refreshed (and re-stored) when it expires within a minute. */
async function accessToken(userId: string, s: Stored): Promise<string> {
  if (new Date(s.expires_at).getTime() - Date.now() > 60_000) return s.access_token;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refresh_token });
  const { error } = await stravaAdmin().rpc('connection_save_for_user', {
    p_user_id: userId,
    p_provider: 'strava', p_external_user_id: '', p_display_name: null,
    p_access_token: t.access_token, p_refresh_token: t.refresh_token,
    p_expires_at: new Date(t.expires_at * 1000).toISOString(), p_scope: null,
  });
  if (error) throw new Error('Could not save refreshed Strava credentials');
  return t.access_token;
}

type Summary = { id: number; name: string; sport_type?: string; type?: string; moving_time: number; start_date_local: string; kilojoules?: number };
type Detail = Summary & { calories?: number };

const KIND_BY_SPORT: Record<string, string> = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run',
  Walk: 'walk', Hike: 'walk',
  Ride: 'cycle', VirtualRide: 'cycle', EBikeRide: 'cycle', MountainBikeRide: 'cycle', GravelRide: 'cycle',
  Swim: 'swim',
  WeightTraining: 'strength', Crossfit: 'strength',
  Yoga: 'yoga', Pilates: 'yoga',
  HighIntensityIntervalTraining: 'hiit',
  Badminton: 'sport', Tennis: 'sport', Squash: 'sport', Soccer: 'sport', TableTennis: 'sport', Pickleball: 'sport',
};

/** Pure: how a Strava activity becomes a workout row. Exported for tests. */
export function toWorkout(a: Detail, weightKg: number) {
  const kind = KIND_BY_SPORT[a.sport_type ?? a.type ?? ''] ?? 'other';
  const minutes = Math.min(600, Math.max(1, Math.round(a.moving_time / 60)));
  const met = WORKOUT_PRESETS.find(p => p.kind === kind)?.met ?? 4;
  // Strava's own calories when present; rides report mechanical work, and kJ of work ≈ kcal burned.
  const device = a.calories && a.calories > 0 ? a.calories : a.kilojoules && a.kilojoules > 0 ? a.kilojoules : 0;
  const kcal = Math.min(5000, Math.round(device > 0 ? device : estimateBurn(met, weightKg, minutes)));
  // start_date_local is the athlete's wall-clock time with a misleading "Z"; read its date and time as written.
  const time = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(a.start_date_local)?.[1] ?? null;
  return {
    day: a.start_date_local.slice(0, 10), start_time: time, kind: 'strava', label: (a.name || 'Strava activity').slice(0, 80),
    minutes, kcal, kcal_source: device > 0 ? 'device' : 'estimate', source: 'strava', external_id: String(a.id),
    sport: kind,
  } as const;
}

async function api<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (res.status === 429) throw new Error('Strava rate limit');
  if (!res.ok) throw new Error(`Strava ${res.status}`);
  return res.json() as Promise<T>;
}

export type SyncResult = { imported: number; skipped?: 'recent' | 'not-connected' };

/** Imports activities since the last sync (first time: two weeks). Throttled unless `force`. */
export async function sync(supabase: SupabaseClient, userId: string, weightKg: number, force = false): Promise<SyncResult> {
  const s = await stored(userId);
  if (!s) return { imported: 0, skipped: 'not-connected' };
  if (!force && !s.sync_after && s.last_sync_at && Date.now() - new Date(s.last_sync_at).getTime() < SYNC_EVERY_MS) return { imported: 0, skipped: 'recent' };

  const token = await accessToken(userId, s);
  // Keep a fixed window and page until every activity in it is persisted. A partial batch or failed write
  // must never advance last_sync_at. The stored window also survives retries more than fourteen days later.
  const after = s.sync_after ?? new Date(s.last_sync_at ? Date.parse(s.last_sync_at) - 2 * 86_400_000 : Date.now() - FIRST_SYNC_DAYS * 86_400_000).toISOString();
  const before = s.sync_before ?? new Date().toISOString();
  let page = s.sync_page || 1;
  const progress = async (complete = false) => {
    const { error } = await stravaAdmin().rpc('connection_sync_progress', {
      p_user_id: userId, p_after: after, p_before: before, p_page: page, p_complete: complete,
    });
    if (error) throw new Error('Could not save Strava sync progress');
  };
  await progress();
  let imported = 0;
  // Bound requests per invocation; the next sync resumes this page/window.
  for (let pages = 0; pages < 3; pages++) {
    const list = await api<Summary[]>(token, `/athlete/activities?after=${Math.floor(Date.parse(after) / 1000)}&before=${Math.floor(Date.parse(before) / 1000)}&per_page=50&page=${page}`);
    const ids = list.map(a => String(a.id));
    const { data: known, error: readError } = ids.length
      ? await supabase.from('workouts').select('external_id').eq('source', 'strava').in('external_id', ids)
      : { data: [], error: null };
    if (readError) throw new Error('Could not read imported workouts');
    const seen = new Set((known ?? []).map(k => k.external_id));
    for (const a of list.filter(a => !seen.has(String(a.id)))) {
      if (imported >= MAX_NEW_PER_SYNC) { await progress(); return { imported }; }
      const detail = await api<Detail>(token, `/activities/${a.id}`).catch(() => a as Detail);
      const w = toWorkout(detail, weightKg);
      const { error } = await supabase.from('workouts').upsert(
        { user_id: userId, day: w.day, start_time: w.start_time, kind: w.sport, label: w.label, minutes: w.minutes, kcal: w.kcal, kcal_source: w.kcal_source, source: 'strava', external_id: w.external_id },
        { onConflict: 'user_id,source,external_id', ignoreDuplicates: true },
      );
      if (error) throw new Error('Could not save an imported workout');
      imported++;
    }
    if (list.length < 50) { await progress(true); return { imported }; }
    page++;
    await progress();
  }
  return { imported };
}

/** Revokes Shoku's access at Strava (best effort) and deletes the connection and imported workouts. */
export async function disconnect(supabase: SupabaseClient, userId: string) {
  const s = await stored(userId);
  if (s) {
    await fetch(`${OAUTH}/deauthorize`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: s.access_token }), signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  }
  const { error } = await supabase.rpc('connection_remove', { p_provider: 'strava' });
  if (error) throw new Error('Could not remove the Strava connection');
}
