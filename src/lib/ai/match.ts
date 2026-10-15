// Pure helpers that map AI Assist's proposed foods onto the Katori catalogue. No I/O: unit tested.
import type { Food } from '../nutrition';

/** What the model proposes for one food on the plate or in the sentence. */
export type ProposedFood = { foodId?: string | null; name: string; servings: number; confidence?: number };

/** One reviewable row. foodId is null when nothing in the catalogue matched: the user picks it by hand. */
export type AiSuggestion = {
  foodId: string | null;
  /** The model's own words for the food, shown when unmatched and used to prefill the search. */
  name: string;
  quantity: number;
  confidence: number;
  matchedBy: 'id' | 'name' | null;
};

export const MIN_SERVINGS = 0.25;
export const MAX_SERVINGS = 20;

/** Clamps a serving count to 0.25–20 and rounds it to the nearest quarter. Junk becomes 1. */
export function clampServings(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return 1;
  const r = Math.round(v * 4) / 4;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, r));
}

export function clampConfidence(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(v * 100) / 100));
}

// Common Hinglish / transliteration spellings, folded onto the spelling the catalogue uses.
const VARIANTS: Record<string, string> = {
  daal: 'dal', dhal: 'dal', dahl: 'dal',
  chapathi: 'chapati', chapatti: 'chapati', chappati: 'chapati', chapatis: 'chapati', fulka: 'phulka', rotli: 'roti',
  subzi: 'sabzi', subji: 'sabzi', sabji: 'sabzi', sabjee: 'sabzi', sabzee: 'sabzi',
  dahee: 'dahi', yoghurt: 'yogurt', yogurts: 'yogurt',
  chhole: 'chole', cholay: 'chole', chholey: 'chole', chana: 'chana', channa: 'chana',
  parantha: 'paratha', prantha: 'paratha', parotta: 'paratha',
  idly: 'idli', dosai: 'dosa', sambhar: 'sambar', sambaar: 'sambar',
  rajmah: 'rajma', kichdi: 'khichdi', khichri: 'khichdi', khichadi: 'khichdi',
  briyani: 'biryani', biriyani: 'biryani', biriani: 'biryani',
  murg: 'murgh', anda: 'egg', ande: 'egg', aloo: 'aloo', alu: 'aloo',
  chaach: 'chaas', chhaas: 'chaas', lassi: 'lassi', tea: 'tea', chay: 'chai', chaai: 'chai',
  makhane: 'makhana', moongfali: 'mungfali', mungphali: 'mungfali',
};

// Words that describe the portion or container rather than the food itself.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'with', 'some', 'little', 'bit', 'few', 'one', 'two', 'three', 'half', 'full',
  'katori', 'bowl', 'plate', 'glass', 'cup', 'piece', 'pieces', 'serving', 'portion', 'small', 'medium', 'large', 'big',
  'homemade', 'home', 'made', 'fresh', 'hot', 'cold', 'ka', 'ki', 'ke', 'aur', 'bhi', 'thoda', 'ek', 'do',
]);

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalise(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Folds simple English plurals: rotis -> roti, tomatoes -> tomato, eggs -> egg (but not "chaas", "oats" stays "oat" on both sides). */
export function singular(w: string): string {
  if (w.length <= 3 || w.endsWith('ss')) return w;
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function canonicalToken(w: string): string {
  const v = VARIANTS[w] ?? w;
  const s = singular(v);
  return VARIANTS[s] ?? s;
}

/** Canonical tokens of a phrase, without numbers. Keeps stopwords out only when asked (queries). */
export function tokens(s: string, dropStopwords = false): string[] {
  return normalise(s)
    .split(' ')
    .filter(w => w && !/^\d+$/.test(w) && !(dropStopwords && STOPWORDS.has(w)))
    .map(canonicalToken);
}

type Indexed = { food: Food; name: Set<string>; alias: Set<string>; full: string };

export function indexFoods(foods: Food[]): Indexed[] {
  return foods.map(food => ({
    food,
    name: new Set([...tokens(food.name), ...tokens(food.id.replace(/-/g, ' '))]),
    alias: new Set(tokens(food.aliases ?? '')),
    full: tokens(food.name).join(' '),
  }));
}

/**
 * Best catalogue match for a free-text food name, or null. Name hits outweigh alias hits, and among equal hits
 * the food whose name is most fully covered wins ("rice" -> "Rice, cooked", not "Brown rice, cooked").
 */
export function matchByName(query: string, index: Indexed[]): Food | null {
  const q = [...new Set(tokens(query, true))];
  if (!q.length) return null;
  const joined = q.join(' ');
  let best: { food: Food; score: number } | null = null;
  for (const it of index) {
    if (it.full === joined) return it.food;
    let hits = 0, nameHits = 0;
    for (const t of q) {
      if (it.name.has(t)) { hits += 1; nameHits++; }
      else if (it.alias.has(t)) hits += 0.8;
    }
    if (hits / q.length < 0.5) continue;
    const score = hits / q.length + 0.3 * (nameHits / Math.max(1, it.name.size));
    if (!best || score > best.score + 1e-9) best = { food: it.food, score };
  }
  return best?.food ?? null;
}

/**
 * Maps proposals to catalogue foods: a valid foodId wins, else a fuzzy name match, else kept unmatched (foodId null).
 * Matched duplicates are merged so "roti" twice becomes one row with both portions.
 */
export function matchSuggestions(proposed: ProposedFood[], foods: Food[]): AiSuggestion[] {
  const byId = new Map(foods.map(f => [f.id, f]));
  const index = indexFoods(foods);
  const out: AiSuggestion[] = [];
  for (const p of proposed) {
    const name = (p.name ?? '').trim().slice(0, 80);
    const id = typeof p.foodId === 'string' ? p.foodId.trim() : '';
    let food: Food | null = id && byId.has(id) ? byId.get(id)! : null;
    let matchedBy: AiSuggestion['matchedBy'] = food ? 'id' : null;
    if (!food && name) {
      food = matchByName(name, index);
      if (food) matchedBy = 'name';
    }
    if (!food && !name) continue;
    const quantity = clampServings(p.servings);
    const confidence = clampConfidence(p.confidence);
    const dup = food ? out.find(o => o.foodId === food!.id) : undefined;
    if (dup) {
      dup.quantity = clampServings(dup.quantity + quantity);
      dup.confidence = Math.min(dup.confidence, confidence);
      continue;
    }
    out.push({ foodId: food?.id ?? null, name: name || food!.name, quantity, confidence, matchedBy });
  }
  return out;
}

/** Compact catalogue line the model chooses from: id|name|unit|grams|aliases. */
export function catalogueLines(foods: Food[]): string {
  return foods.map(f => [f.id, f.name, f.unit, Math.round(f.grams), (f.aliases ?? '').slice(0, 60)].join('|')).join('\n');
}
