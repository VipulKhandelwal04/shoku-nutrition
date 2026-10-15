import 'server-only';
import type { Part } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getFoods } from '../data/queries';
import type { Meal } from '../nutrition';
import { suggestionOutput, type SuggestResponse } from './contracts';
import { generateJson } from './gemini';
import { recordUsage } from './guard';
import { errorResponse, ok } from './http';
import { catalogueLines, matchSuggestions } from './match';

/** Shared photo/text pipeline: catalogue → Gemini (JSON) → match to catalogue → record usage → respond. */
export async function suggestFoods(args: {
  feature: 'photo' | 'text';
  supabase: SupabaseClient;
  usageId: number;
  system: string;
  input: Part;
  meal: Meal;
  day: string;
  signal?: AbortSignal;
}) {
  let success = false;
  try {
    const foods = await getFoods();
    const out = await generateJson(suggestionOutput, {
      system: args.system,
      parts: [{ text: `Catalogue (id|name|unit|grams|aliases):\n${catalogueLines(foods)}` }, args.input],
      signal: args.signal,
    });
    const items = matchSuggestions(out.items, foods);
    success = true;
    const note = out.note.trim().slice(0, 200) || null;
    return ok<SuggestResponse>({ items, note, meal: args.meal, day: args.day });
  } catch (err) {
    return errorResponse(err, args.feature);
  } finally {
    await recordUsage(args.supabase, args.feature, success, args.usageId);
  }
}
