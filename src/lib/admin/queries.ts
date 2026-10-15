import 'server-only';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '../supabase/server';
import { DEFAULT_AI_SETTINGS, type AiSettings, type FeatureSettings, type FoodRow, type Quote, type RecipeRow, type TourSlide } from '../types';
import type { AiUsageRow, UserStatRow } from './stats';

// Admin reads. RLS + is_admin() guard every query; user data comes only from the aggregate admin_* functions.

/** Shared catalogue only (owner_id null), active and inactive. Users' custom foods are never listed. */
export async function adminFoods(): Promise<FoodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('foods').select('*').is('owner_id', null).order('category').order('name');
  if (error) throw new Error(`Could not load the food catalogue: ${error.message}`);
  return (data ?? []) as FoodRow[];
}

export async function adminQuotes(): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('quotes').select('id, text, author, active, sort').order('sort').order('id');
  if (error) throw new Error(`Could not load quotes: ${error.message}`);
  return (data ?? []) as Quote[];
}

export async function adminTourSlides(): Promise<TourSlide[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('tour_slides').select('id, title, body, image_url, sort, active').order('sort').order('id');
  if (error) throw new Error(`Could not load tour slides: ${error.message}`);
  return (data ?? []) as TourSlide[];
}

export async function adminUserStats(): Promise<UserStatRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_user_stats');
  if (error) throw new Error(`Could not load user stats: ${error.message}`);
  return ((data ?? []) as UserStatRow[]).map(r => ({ ...r, days_logged_30d: Number(r.days_logged_30d) || 0, ai_calls_today: Number(r.ai_calls_today) || 0 }));
}

export async function adminAiUsage(days: number): Promise<AiUsageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_ai_usage', { days });
  if (error) throw new Error(`Could not load AI usage: ${error.message}`);
  return ((data ?? []) as AiUsageRow[]).map(r => ({ ...r, calls: Number(r.calls) || 0, failures: Number(r.failures) || 0 }));
}

/** Raw stored settings (not merged with the env check), so the form shows exactly what is saved. */
export async function adminAiSettings(): Promise<AiSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai').maybeSingle();
  return { ...DEFAULT_AI_SETTINGS, ...((data?.value as Partial<AiSettings> | null) ?? {}) };
}

export async function adminFeatureSettings(): Promise<FeatureSettings & { updated_at: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value, updated_at').eq('key', 'features').maybeSingle();
  return { signups_open: true, ...((data?.value as Partial<FeatureSettings> | null) ?? {}), updated_at: (data?.updated_at as string | undefined) ?? null };
}

/** Images shipped in public/img, discovered at request time so new files appear without a code change. */
export async function localImages(): Promise<string[]> {
  const known = ['/img/hero.webp', '/img/breakfast.webp', '/img/lunch.webp', '/img/snacks.webp', '/img/dinner.webp'];
  try {
    const files = await readdir(path.join(process.cwd(), 'public', 'img'));
    const found = files.filter(f => /\.(webp|png|jpe?g|avif)$/i.test(f)).map(f => `/img/${f}`);
    return Array.from(new Set([...known, ...found])).sort();
  } catch {
    return known;
  }
}

/** Every recipe, drafts included. Admin-only by RLS. */
export async function adminRecipes(): Promise<RecipeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('recipes').select('*').order('name');
  if (error) throw new Error(`Could not load recipes: ${error.message}`);
  return ((data ?? []) as RecipeRow[]).map(r => ({ ...r, servings: Number(r.servings), ingredients: (r.ingredients ?? []).map(i => ({ foodId: i.foodId, q: Number(i.q) })) }));
}
