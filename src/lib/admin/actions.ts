'use server';
// Admin mutations. Every action re-checks the caller is an active admin (server actions are public POST
// endpoints), validates with zod, and returns { ok, error } with a human message instead of throwing.
import { revalidatePath } from 'next/cache';
import { getProfile } from '../auth';
import { createClient } from '../supabase/server';
import type { Profile } from '../types';
import {
  aiSettingsSchema,
  flagsSchema,
  disabledSchema,
  featureSettingsSchema,
  foodSchema,
  idSchema,
  invalid,
  moveSchema,
  quoteSchema,
  roleSchema,
  SLUG_RE,
  tourSlideSchema,
  type ActionResult,
} from './schemas';
import { nextSort, reorder } from './stats';

type Admin = { profile: Profile; supabase: Awaited<ReturnType<typeof createClient>> };

async function admin(): Promise<Admin | null> {
  const profile = await getProfile();
  if (!profile || profile.disabled || profile.role !== 'admin') return null;
  return { profile, supabase: await createClient() };
}

const DENIED: ActionResult = { ok: false, error: 'Only admins can do that. Sign in again with an admin account.' };

function done(opts: { publicContent?: boolean; message?: string } = {}): ActionResult {
  revalidatePath('/admin', 'layout');
  if (opts.publicContent) revalidatePath('/');
  return { ok: true, message: opts.message };
}

/** Postgres/PostgREST errors -> something an operator can act on. */
function dbError(err: { message: string; code?: string } | null, fallback: string): ActionResult {
  if (!err) return { ok: false, error: fallback };
  if (err.code === '42501' || /row-level security|permission denied|Admins only/i.test(err.message)) return DENIED;
  if (err.code === '23514') return { ok: false, error: 'A value is outside the allowed range. Check the fields and try again.' };
  return { ok: false, error: `${fallback} (${err.message})` };
}

// ---------------------------------------------------------------- Foods
export async function createFood(input: unknown): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = foodSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { error } = await a.supabase.from('foods').insert({ ...v, owner_id: null });
  if (error?.code === '23505') {
    return { ok: false, error: `The id “${v.id}” is already taken.`, fieldErrors: { id: 'This id is already used by another food. Pick a different one.' } };
  }
  if (error) return dbError(error, 'Could not add the food');
  return done({ message: `${v.name} added to the catalogue.` });
}

export async function updateFood(input: unknown): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = foodSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...rest } = parsed.data;
  const { data, error } = await a.supabase
    .from('foods')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('owner_id', null)
    .select('id');
  if (error) return dbError(error, 'Could not save the food');
  if (!data?.length) return { ok: false, error: 'That food no longer exists in the catalogue. Refresh and try again.' };
  return done({ message: `${rest.name} saved.` });
}

export async function setFoodActive(id: string, active: boolean): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  if (typeof id !== 'string' || !SLUG_RE.test(id) || typeof active !== 'boolean') return { ok: false, error: 'Unknown food.' };
  const { data, error } = await a.supabase
    .from('foods')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('owner_id', null)
    .select('name');
  if (error) return dbError(error, 'Could not change the food');
  if (!data?.length) return { ok: false, error: 'That food no longer exists in the catalogue.' };
  const name = (data[0] as { name: string }).name;
  return done({ message: active ? `${name} is live again.` : `${name} hidden from search. Past entries keep it.` });
}

/** Hard delete. Entries that referenced it keep their snapshot; entries.food_id becomes null. */
export async function deleteFood(id: string): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  if (typeof id !== 'string' || !SLUG_RE.test(id)) return { ok: false, error: 'Unknown food.' };
  const { data, error } = await a.supabase.from('foods').delete().eq('id', id).is('owner_id', null).select('name');
  if (error) return dbError(error, 'Could not delete the food');
  if (!data?.length) return { ok: false, error: 'That food no longer exists in the catalogue.' };
  return done({ message: `${(data[0] as { name: string }).name} deleted.` });
}

// ---------------------------------------------------------------- Quotes & tour slides
type ContentTable = 'quotes' | 'tour_slides';

async function moveRow(table: ContentTable, input: unknown): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Unknown item.' };
  const { data, error } = await a.supabase.from(table).select('id, sort');
  if (error) return dbError(error, 'Could not reorder');
  const updates = reorder((data ?? []) as { id: number; sort: number }[], parsed.data.id, parsed.data.dir);
  if (!updates.length) return { ok: false, error: parsed.data.dir === 'up' ? 'Already first.' : 'Already last.' };
  for (const u of updates) {
    const { error: e } = await a.supabase.from(table).update({ sort: u.sort }).eq('id', u.id);
    if (e) return dbError(e, 'Could not save the new order');
  }
  return done({ publicContent: true });
}

async function insertRow(table: ContentTable, values: Record<string, unknown>, what: string): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const { data: rows } = await a.supabase.from(table).select('sort');
  const { error } = await a.supabase.from(table).insert({ ...values, sort: nextSort((rows ?? []) as { sort: number }[]) });
  if (error) return dbError(error, `Could not add the ${what}`);
  return done({ publicContent: true, message: `${what[0].toUpperCase()}${what.slice(1)} added.` });
}

async function updateRow(table: ContentTable, id: unknown, values: Record<string, unknown>, what: string): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  if (!idSchema.safeParse(id).success) return { ok: false, error: `Unknown ${what}.` };
  const { data, error } = await a.supabase.from(table).update(values).eq('id', id as number).select('id');
  if (error) return dbError(error, `Could not save the ${what}`);
  if (!data?.length) return { ok: false, error: `That ${what} no longer exists. Refresh and try again.` };
  return done({ publicContent: true });
}

async function deleteRow(table: ContentTable, id: unknown, what: string): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  if (!idSchema.safeParse(id).success) return { ok: false, error: `Unknown ${what}.` };
  const { error } = await a.supabase.from(table).delete().eq('id', id as number);
  if (error) return dbError(error, `Could not delete the ${what}`);
  return done({ publicContent: true, message: `${what[0].toUpperCase()}${what.slice(1)} deleted.` });
}

export async function createQuote(input: unknown): Promise<ActionResult> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return insertRow('quotes', parsed.data, 'quote');
}
export async function updateQuote(id: number, input: unknown): Promise<ActionResult> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await updateRow('quotes', id, parsed.data, 'quote');
  return r.ok ? { ok: true, message: 'Quote saved.' } : r;
}
export async function setQuoteActive(id: number, active: boolean): Promise<ActionResult> {
  if (typeof active !== 'boolean') return { ok: false, error: 'Unknown state.' };
  const r = await updateRow('quotes', id, { active }, 'quote');
  return r.ok ? { ok: true, message: active ? 'Quote is live on the splash.' : 'Quote hidden from the splash.' } : r;
}
export async function moveQuote(id: number, dir: 'up' | 'down'): Promise<ActionResult> {
  return moveRow('quotes', { id, dir });
}
export async function deleteQuote(id: number): Promise<ActionResult> {
  return deleteRow('quotes', id, 'quote');
}

export async function createTourSlide(input: unknown): Promise<ActionResult> {
  const parsed = tourSlideSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return insertRow('tour_slides', parsed.data, 'slide');
}
export async function updateTourSlide(id: number, input: unknown): Promise<ActionResult> {
  const parsed = tourSlideSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await updateRow('tour_slides', id, parsed.data, 'slide');
  return r.ok ? { ok: true, message: 'Slide saved.' } : r;
}
export async function setTourSlideActive(id: number, active: boolean): Promise<ActionResult> {
  if (typeof active !== 'boolean') return { ok: false, error: 'Unknown state.' };
  const r = await updateRow('tour_slides', id, { active }, 'slide');
  return r.ok ? { ok: true, message: active ? 'Slide is live on the home tour.' : 'Slide hidden from the home tour.' } : r;
}
export async function moveTourSlide(id: number, dir: 'up' | 'down'): Promise<ActionResult> {
  return moveRow('tour_slides', { id, dir });
}
export async function deleteTourSlide(id: number): Promise<ActionResult> {
  return deleteRow('tour_slides', id, 'slide');
}

// ---------------------------------------------------------------- Users (aggregate-only; never diaries)
function userRpcError(err: { message: string; code?: string }, fallback: string): ActionResult {
  if (/Keep at least one admin/i.test(err.message)) return { ok: false, error: 'Keep at least one admin. Make someone else an admin first.' };
  if (/cannot disable your own account/i.test(err.message)) return { ok: false, error: 'You can’t pause your own account.' };
  return dbError(err, fallback);
}

export async function setUserRole(target: string, role: 'user' | 'admin'): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = roleSchema.safeParse({ target, role });
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await a.supabase.rpc('admin_set_role', { target: parsed.data.target, new_role: parsed.data.role });
  if (error) return userRpcError(error, 'Could not change the role');
  return done({ message: role === 'admin' ? 'Admin access granted.' : 'Admin access removed.' });
}

export async function setUserDisabled(target: string, disabled: boolean): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = disabledSchema.safeParse({ target, disabled });
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.target === a.profile.id && parsed.data.disabled) return { ok: false, error: 'You can’t pause your own account.' };
  const { error } = await a.supabase.rpc('admin_set_disabled', { target: parsed.data.target, is_disabled: parsed.data.disabled });
  if (error) return userRpcError(error, 'Could not change the account');
  return done({ message: disabled ? 'Account paused. They are signed out on their next visit.' : 'Account restored.' });
}

// ---------------------------------------------------------------- Settings
async function saveSetting(a: Admin, key: 'ai' | 'features' | 'flags', value: Record<string, unknown>): Promise<ActionResult | null> {
  const { error } = await a.supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: a.profile.id }, { onConflict: 'key' });
  return error ? dbError(error, 'Could not save the setting') : null;
}

export async function saveAiSettings(input: unknown): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const failed = await saveSetting(a, 'ai', parsed.data);
  if (failed) return failed;
  revalidatePath('/', 'layout'); // AI Assist entry points across the app read this flag.
  return done();
}

/** Saves every product feature flag at once (primary + secondary). Entry points across the app read these. */
export async function saveFlags(input: unknown): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = flagsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Those switches didn’t save. Reload the page and try again.' };
  const failed = await saveSetting(a, 'flags', parsed.data);
  if (failed) return failed;
  revalidatePath('/', 'layout');
  return done();
}

export async function saveFeatureSettings(input: unknown): Promise<ActionResult> {
  const a = await admin();
  if (!a) return DENIED;
  const parsed = featureSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  // Merge so future keys in 'features' are not wiped by this form.
  const { data } = await a.supabase.from('app_settings').select('value').eq('key', 'features').maybeSingle();
  const current = (data?.value as Record<string, unknown> | null) ?? {};
  const failed = await saveSetting(a, 'features', { ...current, ...parsed.data });
  if (failed) return failed;
  return done({ publicContent: true, message: parsed.data.signups_open ? 'Sign-ups are open.' : 'Sign-ups are closed. Existing members can still sign in.' });
}
