import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../seed-foods';
import { canonicalToken, catalogueLines, clampServings, indexFoods, matchByName, matchSuggestions, normalise } from './match';

const index = indexFoods(SEED_FOODS);
const idOf = (q: string) => matchByName(q, index)?.id ?? null;

describe('clampServings', () => {
  it('rounds to the nearest quarter', () => {
    expect(clampServings(1.1)).toBe(1);
    expect(clampServings(1.13)).toBe(1.25);
    expect(clampServings(2.6)).toBe(2.5);
  });
  it('clamps to 0.25–20', () => {
    expect(clampServings(0.05)).toBe(0.25);
    expect(clampServings(99)).toBe(20);
  });
  it('turns junk into one serving', () => {
    expect(clampServings(Number.NaN)).toBe(1);
    expect(clampServings(-2)).toBe(1);
    expect(clampServings('3')).toBe(3);
    expect(clampServings(undefined)).toBe(1);
  });
});

describe('normalise and tokens', () => {
  it('strips case, accents and punctuation', () => {
    expect(normalise('  Dāl-Makhani, (Spicy)! ')).toBe('dal makhani spicy');
  });
  it('folds plurals and Hinglish spellings', () => {
    expect(canonicalToken('rotis')).toBe('roti');
    expect(canonicalToken('daal')).toBe('dal');
    expect(canonicalToken('chapathi')).toBe('chapati');
    expect(canonicalToken('tomatoes')).toBe('tomato');
    expect(canonicalToken('idlis')).toBe('idli');
    expect(canonicalToken('glass')).toBe('glass');
  });
});

describe('matchByName', () => {
  it('matches plurals and spelling variants', () => {
    expect(idOf('rotis')).toBe('chapati');
    expect(idOf('2 Chapathis')).toBe('chapati');
    expect(idOf('daal')).toBe('dal');
    expect(idOf('dahi')).toBe('curd');
    expect(idOf('a katori of curd')).toBe('curd');
    expect(idOf('Idlis')).toBe('idli');
    expect(idOf('sambhar')).toBe('sambar');
    expect(idOf('subzi')).toBe('sabzi');
    expect(idOf('anda')).toBe('egg');
    expect(idOf('boiled eggs')).toBe('egg');
  });
  it('prefers the food whose name is most fully covered', () => {
    expect(idOf('rice')).toBe('rice');
    expect(idOf('brown rice')).toBe('brown-rice');
    expect(idOf('dal')).toBe('dal');
  });
  it('returns null when nothing is close', () => {
    expect(idOf('pizza')).toBeNull();
    expect(idOf('')).toBeNull();
    expect(idOf('a bowl of')).toBeNull();
  });
});

describe('matchSuggestions', () => {
  it('prefers a valid foodId over the name', () => {
    const [s] = matchSuggestions([{ foodId: 'rajma', name: 'kidney beans curry', servings: 1, confidence: 0.9 }], SEED_FOODS);
    expect(s).toMatchObject({ foodId: 'rajma', matchedBy: 'id', quantity: 1, confidence: 0.9 });
  });
  it('falls back to the name when the id is unknown', () => {
    const [s] = matchSuggestions([{ foodId: 'made-up', name: 'rotis', servings: 2, confidence: 0.8 }], SEED_FOODS);
    expect(s).toMatchObject({ foodId: 'chapati', matchedBy: 'name', quantity: 2 });
  });
  it('keeps unmatched foods with foodId null so the user can pick', () => {
    const [s] = matchSuggestions([{ foodId: null, name: 'Gulab jamun', servings: 2, confidence: 0.7 }], SEED_FOODS);
    expect(s).toMatchObject({ foodId: null, name: 'Gulab jamun', matchedBy: null, quantity: 2 });
  });
  it('merges duplicates and clamps quantity and confidence', () => {
    const out = matchSuggestions([
      { foodId: 'chapati', name: 'roti', servings: 2, confidence: 0.9 },
      { foodId: null, name: 'rotis', servings: 1.1, confidence: 1.4 },
      { foodId: 'dal', name: 'dal', servings: 40, confidence: -1 },
    ], SEED_FOODS);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ foodId: 'chapati', quantity: 3, confidence: 0.9 });
    expect(out[1]).toMatchObject({ foodId: 'dal', quantity: 20, confidence: 0 });
  });
  it('drops rows with neither a usable id nor a name', () => {
    expect(matchSuggestions([{ foodId: 'nope', name: '  ', servings: 1 }], SEED_FOODS)).toEqual([]);
  });
});

describe('catalogueLines', () => {
  it('writes one compact id|name|unit|grams|aliases line per food', () => {
    const line = catalogueLines(SEED_FOODS).split('\n').find(l => l.startsWith('chapati|'));
    expect(line).toBe('chapati|Whole wheat roti|roti|40|chapati phulka chappati');
  });
});
