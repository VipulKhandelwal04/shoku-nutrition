import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
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
export async function connect(supabase: SupabaseClient, code: string, grantedScope: string | null) {
  const t = await tokenRequest({ code, grant_type: 'authorization_code' });
  const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || null;
  const { error } = await supabase.rpc('connection_save', {
    p_provider: 'strava', p_external_user_id: String(t.athlete?.id ?? ''), p_display_name: name,
    p_access_token: t.access_token, p_refresh_token: t.refresh_token,
    p_expires_at: new Date(t.expires_at * 1000).toISOString(), p_scope: grantedScope,
  });
  if (error) throw new Error('Could not save the Strava connection');
}

type Stored = { access_token: string; refresh_token: string; expires_at: string; last_sync_at: string | null };

async function stored(supabase: SupabaseClient): Promise<Stored | null> {
  const { data } = await supabase.rpc('connection_tokens', { p_provider: 'strava' });
  return (data?.[0] as Stored | undefined) ?? null;
}

/** A valid access token, refreshed (and re-stored) when it expires within a minute. */
async function accessToken(supabase: SupabaseClient, s: Stored): Promise<string> {
  if (new Date(s.expires_at).getTime() - Date.now() > 60_000) return s.access_token;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refresh_token });
  await supabase.rpc('connection_save', {
    p_provider: 'strava', p_external_user_id: '', p_display_name: null,
    p_access_token: t.access_token, p_refresh_token: t.refresh_token,
    p_expires_at: new Date(t.expires_at * 1000).toISOString(), p_scope: null,
  });
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
  const s = await stored(supabase);
  if (!s) return { imported: 0, skipped: 'not-connected' };
  if (!force && s.last_sync_at && Date.now() - new Date(s.last_sync_at).getTime() < SYNC_EVERY_MS) return { imported: 0, skipped: 'recent' };

  const token = await accessToken(supabase, s);
  const since = s.last_sync_at ? new Date(s.last_sync_at).getTime() - 2 * 86_400_000 : Date.now() - FIRST_SYNC_DAYS * 86_400_000;
  const list = await api<Summary[]>(token, `/athlete/activities?after=${Math.floor(since / 1000)}&per_page=50`);

  const ids = list.map(a => String(a.id));
  const { data: known } = ids.length
    ? await supabase.from('workouts').select('external_id').eq('source', 'strava').in('external_id', ids)
    : { data: [] as { external_id: string }[] };
  const seen = new Set((known ?? []).map(k => k.external_id));
  const fresh = list.filter(a => !seen.has(String(a.id))).slice(0, MAX_NEW_PER_SYNC);

  let imported = 0;
  for (const a of fresh) {
    // Calories are only on the detailed activity.
    const detail = await api<Detail>(token, `/activities/${a.id}`).catch(() => a as Detail);
    const w = toWorkout(detail, weightKg);
    const { error } = await supabase.from('workouts').upsert(
      { user_id: userId, day: w.day, start_time: w.start_time, kind: w.sport, label: w.label, minutes: w.minutes, kcal: w.kcal, kcal_source: w.kcal_source, source: 'strava', external_id: w.external_id },
      { onConflict: 'user_id,source,external_id', ignoreDuplicates: true },
    );
    if (!error) imported++;
  }
  await supabase.rpc('connection_mark_synced', { p_provider: 'strava', p_at: new Date().toISOString() });
  return { imported };
}

/** Revokes Shoku's access at Strava (best effort) and deletes the connection and imported workouts. */
export async function disconnect(supabase: SupabaseClient) {
  const s = await stored(supabase);
  if (s) {
    await fetch(`${OAUTH}/deauthorize`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: s.access_token }), signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  }
  const { error } = await supabase.rpc('connection_remove', { p_provider: 'strava' });
  if (error) throw new Error('Could not remove the Strava connection');
}
