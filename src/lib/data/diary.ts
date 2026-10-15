'use server';
// Diary mutations shared by the app screens and the AI confirm flows. All run as the signed-in user under RLS.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { BADGES, MEALS, earnedBadges, streakInfo, type Food } from '../nutrition';
import { createClient } from '../supabase/server';
import type { EntrySource } from '../types';
import { getMealsByDay } from './queries';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date');
const meal = z.enum(MEALS);
const source = z.enum(['manual', 'quick', 'repeat', 'plan', 'photo_ai', 'text_ai']);

const addSchema = z.object({
  day,
  items: z.array(z.object({
    meal,
    foodId: z.string().min(1),
    quantity: z.number().positive('Portion must be above 0').max(100, 'Up to 100 servings'),
    source: source.default('manual'),
    photoPath: z.string().max(300).optional(),
  })).min(1).max(30),
});

async function userOrFail() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

function done() {
  revalidatePath('/app', 'layout');
}

/** Logs one or more foods. Snapshots each food so later catalogue edits never rewrite history. Returns new entry ids (for Undo). */
export async function addEntries(input: z.input<typeof addSchema>): Promise<ActionResult<{ ids: string[]; newBadges: string[] }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the food and portion' };
  const { supabase, user } = await userOrFail();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again to keep logging.' };

  const ids = [...new Set(parsed.data.items.map(i => i.foodId))];
  const { data: foods, error: fErr } = await supabase.from('foods').select('*').in('id', ids);
  if (fErr) return { ok: false, error: 'Couldn’t load those foods. Try again.' };
  const byId = new Map((foods ?? []).map(f => [f.id, f]));
  const missing = ids.filter(id => !byId.has(id));
  if (missing.length) return { ok: false, error: 'One of those foods is no longer available. Search for it again.' };

  const rows = parsed.data.items.map(i => {
    const f = byId.get(i.foodId)!;
    const snapshot: Food = { id: f.id, name: f.name, category: f.category, unit: f.unit, grams: Number(f.grams), kcal: Number(f.kcal), p: Number(f.p), c: Number(f.c), f: Number(f.f), fibre: Number(f.fibre), diet: f.diet, icon: f.icon, aliases: f.aliases, groups: f.groups ?? {}, custom: f.owner_id !== null };
    return { user_id: user.id, day: parsed.data.day, meal: i.meal, food_id: f.id, food: snapshot, quantity: i.quantity, source: i.source as EntrySource, photo_path: i.photoPath ?? null };
  });
  const { data, error } = await supabase.from('entries').insert(rows).select('id');
  if (error) return { ok: false, error: 'Couldn’t save that. Check your connection and try again.' };
  const newBadges = await awardBadges(parsed.data.day);
  done();
  return { ok: true, data: { ids: (data ?? []).map(r => r.id), newBadges } };
}

export async function deleteEntries(ids: string[]): Promise<ActionResult> {
  if (!ids.length || ids.length > 30) return { ok: false, error: 'Nothing to remove' };
  const { supabase, user } = await userOrFail();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { error } = await supabase.from('entries').delete().in('id', ids);
  if (error) return { ok: false, error: 'Couldn’t remove that. Try again.' };
  done();
  return { ok: true, data: undefined };
}

const updateSchema = z.object({ id: z.string().uuid(), quantity: z.number().positive().max(100), meal });
export async function updateEntry(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a portion above 0, up to 100 servings.' };
  const { supabase, user } = await userOrFail();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { error } = await supabase.from('entries').update({ quantity: parsed.data.quantity, meal: parsed.data.meal }).eq('id', parsed.data.id);
  if (error) return { ok: false, error: 'Couldn’t update that portion. Try again.' };
  done();
  return { ok: true, data: undefined };
}

/** Copies a meal from one day to another (e.g. "repeat yesterday's breakfast"). */
export async function repeatMeal(input: { fromDay: string; toDay: string; meal: string }): Promise<ActionResult<{ ids: string[]; newBadges: string[] }>> {
  const parsed = z.object({ fromDay: day, toDay: day, meal }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Couldn’t repeat that meal.' };
  const { supabase, user } = await userOrFail();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { data: src } = await supabase.from('entries').select('food_id, food, quantity').eq('day', parsed.data.fromDay).eq('meal', parsed.data.meal);
  if (!src?.length) return { ok: false, error: 'Nothing to repeat from that day.' };
  const rows = src.map(e => ({ user_id: user.id, day: parsed.data.toDay, meal: parsed.data.meal, food_id: e.food_id, food: e.food, quantity: e.quantity, source: 'repeat' as const }));
  const { data, error } = await supabase.from('entries').insert(rows).select('id');
  if (error) return { ok: false, error: 'Couldn’t repeat that meal. Try again.' };
  const newBadges = await awardBadges(parsed.data.toDay);
  done();
  return { ok: true, data: { ids: (data ?? []).map(r => r.id), newBadges } };
}

export async function changeWater(input: { day: string; deltaMl: number }): Promise<ActionResult<{ waterMl: number }>> {
  const parsed = z.object({ day, deltaMl: z.number().int().min(-2000).max(2000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Couldn’t update water.' };
  const { supabase, user } = await userOrFail();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { data: cur } = await supabase.from('days').select('water_ml').eq('day', parsed.data.day).maybeSingle();
  const waterMl = Math.min(15000, Math.max(0, (cur?.water_ml ?? 0) + parsed.data.deltaMl));
  const { error } = await supabase.from('days').upsert({ user_id: user.id, day: parsed.data.day, water_ml: waterMl, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: 'Couldn’t update water. Try again.' };
  done();
  return { ok: true, data: { waterMl } };
}

/** Optional "done for the day" marker. Streaks count automatically at 3+ meals and do not depend on this. */
export async function setDayDone(input: { day: string; done: boolean }): Promise<ActionResult> {
  const parsed = z.object({ day, done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Couldn’t update the day.' };
  const { supabase, user } = await userOrFail();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const { error } = await supabase.from('days').upsert({ user_id: user.id, day: parsed.data.day, done: parsed.data.done, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: 'Couldn’t update the day. Try again.' };
  done();
  return { ok: true, data: undefined };
}

const customFoodSchema = z.object({
  name: z.string().trim().min(1, 'Enter a food name').max(100),
  unit: z.string().trim().min(1, 'Enter a serving name').max(35),
  grams: z.number().positive('Serving weight must be above 0').max(5000),
  kcal: z.number().min(0).max(10000),
  p: z.number().min(0).max(1000),
  c: z.number().min(0).max(2000),
  f: z.number().min(0).max(1000),
  diet: z.enum(['veg', 'egg', 'nonveg']),
});
export async function createCustomFood(input: z.input<typeof customFoodSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = customFoodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the food details' };
  const { supabase, user } = await userOrFail();
  if (!user) return { ok: false, error: 'Your session ended. Sign in again.' };
  const id = `u-${crypto.randomUUID()}`;
  const { error } = await supabase.from('foods').insert({ id, owner_id: user.id, category: 'Custom', icon: 'bowl', fibre: 0, aliases: '', groups: {}, ...parsed.data });
  if (error) return { ok: false, error: 'Couldn’t save your food. Try again.' };
  done();
  return { ok: true, data: { id } };
}

/** Records newly earned streak badges once. Returns ids that were just unlocked (for the celebration). */
async function awardBadges(today: string): Promise<string[]> {
  const supabase = await createClient();
  const mealsByDay = await getMealsByDay(today);
  const s = streakInfo(mealsByDay, today);
  const earned = earnedBadges(s.best);
  if (!earned.length) return [];
  const { data: have } = await supabase.from('user_badges').select('badge');
  const fresh = earned.filter(b => !(have ?? []).some(h => h.badge === b));
  if (!fresh.length) return [];
  await supabase.from('user_badges').insert(fresh.map(badge => ({ badge })));
  return fresh.filter(b => BADGES.some(x => x.id === b));
}
