import 'server-only';
import { cache } from 'react';
import { createClient } from '../supabase/server';
import { DEFAULT_AI_SETTINGS, type AiSettings, type DayRow, type EntryRow, type FeatureSettings, type FoodRow, type Quote, type TourSlide } from '../types';

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

export const getFeatureSettings = cache(async (): Promise<FeatureSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'features').maybeSingle();
  return { signups_open: true, ...((data?.value as Partial<FeatureSettings>) ?? {}) };
});
