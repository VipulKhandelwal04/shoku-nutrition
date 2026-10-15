import 'server-only';
import { mergeFlags, type FeatureFlags } from '../flags';
import { cache } from 'react';
import { createClient } from '../supabase/server';
import type { FeedbackRow } from '../preferences';
import { DEFAULT_AI_SETTINGS, type AiAssistStatus, type AiSettings, type ConnectionStatus, type DayRow, type EntryRow, type FeatureSettings, type FoodRow, type Quote, type TourSlide, type WorkoutRow } from '../types';

/** Catalogue foods plus the signed-in user's custom foods (RLS decides). */
export const getFoods = cache(async (): Promise<FoodRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('foods').select('*').eq('active', true).order('name');
  if (error) throw new Error(`Could not load foods: ${error.message}`);
  return (data ?? []).map(f => ({ ...f, custom: f.owner_id !== null })) as FoodRow[];
});

export async function getEntries(from: string, to: string): Promise<EntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('entries').select('*').gte('day', from).lte('day', to).order('created_at');
  if (error) throw new Error(`Could not load your diary: ${error.message}`);
  return (data ?? []) as EntryRow[];
}

export async function getDays(from: string, to: string): Promise<DayRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('days').select('day, water_ml, done').gte('day', from).lte('day', to);
  if (error) throw new Error(`Could not load your days: ${error.message}`);
  return (data ?? []) as DayRow[];
}

/** day -> number of distinct meals logged, for streaks. Looks back `lookback` days from `today`. */
export async function getMealsByDay(today: string, lookback = 120): Promise<Record<string, number>> {
  const from = new Date(`${today}T12:00:00`);
  from.setDate(from.getDate() - lookback);
  const supabase = await createClient();
  const { data, error } = await supabase.from('entries').select('day, meal').gte('day', from.toISOString().slice(0, 10)).lte('day', today);
  if (error) throw new Error(`Could not load your streak: ${error.message}`);
  const sets: Record<string, Set<string>> = {};
  for (const r of data ?? []) (sets[r.day] ??= new Set()).add(r.meal);
  return Object.fromEntries(Object.entries(sets).map(([d, s]) => [d, s.size]));
}

/** Visible workouts (manual + imported) between two days, inclusive. */
export async function getWorkouts(from: string, to: string): Promise<WorkoutRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('workouts').select('*').eq('hidden', false).gte('day', from).lte('day', to).order('created_at');
  if (error) throw new Error(`Could not load your workouts: ${error.message}`);
  return (data ?? []) as WorkoutRow[];
}

/** The signed-in user's fitness-app connections (no tokens). Empty when none or on error. */
export async function getConnections(): Promise<ConnectionStatus[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_connections');
  if (error) return [];
  return (data ?? []) as ConnectionStatus[];
}

/** Strava is offered only when the deployment has its OAuth app configured. */
export function isStravaConfigured(): boolean {
  return !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export async function getEarnedBadges(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('user_badges').select('badge');
  return (data ?? []).map(b => b.badge);
}

// ---------- Public content (works signed out) ----------
export const getQuotes = cache(async (): Promise<Quote[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from('quotes').select('*').eq('active', true).order('sort');
  return (data ?? []) as Quote[];
});

export const getTourSlides = cache(async (): Promise<TourSlide[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from('tour_slides').select('*').eq('active', true).order('sort');
  return (data ?? []) as TourSlide[];
});

export const getAiSettings = cache(async (): Promise<AiSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai').maybeSingle();
  return { ...DEFAULT_AI_SETTINGS, ...((data?.value as Partial<AiSettings>) ?? {}) };
});

/**
 * AI Assist status for the UI: the admin master flag, per-feature flags, and whether Gemini is configured.
 * Components hide AI Assist entirely when `available` is false, and each entry point checks `features[x]`.
 */
export const getAiAssist = cache(async (): Promise<AiAssistStatus> => {
  const s = await getAiSettings();
  const configured = !!process.env.GEMINI_API_KEY;
  const on = s.enabled && configured;
  return {
    available: on && (s.photo || s.text || s.plan || s.coach || s.ask),
    configured,
    features: { photo: on && s.photo, text: on && s.text, plan: on && s.plan, coach: on && s.coach, ask: on && s.ask },
    dailyQuota: s.daily_quota,
  };
});

/** Product feature flags (primary + secondary). Missing or unknown values fall back to on. */
export const getFlags = cache(async (): Promise<FeatureFlags> => {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'flags').maybeSingle();
  return mergeFlags(data?.value);
});

export const getFeatureSettings = cache(async (): Promise<FeatureSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'features').maybeSingle();
  return { signups_open: true, ...((data?.value as Partial<FeatureSettings>) ?? {}) };
});

/** The signed-in member's meal ratings, newest first. Empty when none or before the feedback migration. */
export async function getRatings(limit = 100): Promise<FeedbackRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('meal_feedback')
    .select('id, entry_id, kind, title, meal, food_ids, rating, tags, note, created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []) as FeedbackRow[];
}
