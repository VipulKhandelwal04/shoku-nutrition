import { describe, expect, it } from 'vitest';
import { aiSettingsSchema, fieldErrors, foodSchema, imageUrlSchema, quoteSchema, slugify, tourSlideSchema } from './schemas';

const food = {
  id: 'masala-dosa', name: 'Masala dosa', category: 'Breakfast', unit: 'piece', grams: '120', kcal: '250',
  p: '6', c: '38', f: '8', fibre: '3', diet: 'veg', icon: 'plate', aliases: 'dosai', groups: { cer: '30', pul: '8', oil: '', milk: '0' }, active: true,
};

describe('slugify', () => {
  it('makes a clean slug from a name', () => {
    expect(slugify('Paneer Tikka (dry)')).toBe('paneer-tikka-dry');
    expect(slugify('  Crème brûlée!! ')).toBe('creme-brulee');
    expect(slugify('---')).toBe('');
  });
  it('caps length without a trailing hyphen', () => {
    const s = slugify(`${'a'.repeat(59)} b`);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('foodSchema', () => {
  it('coerces numeric strings and drops blank or zero groups', () => {
    const r = foodSchema.parse(food);
    expect(r.grams).toBe(120);
    expect(r.groups).toEqual({ cer: 30, pul: 8 });
  });
  it('rejects bad slugs, zero grams and blank numbers with field errors', () => {
    const r = foodSchema.safeParse({ ...food, id: 'Masala Dosa', grams: '0', kcal: '' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const fe = fieldErrors(r.error);
    expect(fe.id).toMatch(/lowercase/);
    expect(fe.grams).toMatch(/more than 0/);
    expect(fe.kcal).toMatch(/number/);
  });
  it('mirrors DB ranges', () => {
    expect(foodSchema.safeParse({ ...food, kcal: '10001' }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, grams: '5000' }).success).toBe(true);
    expect(foodSchema.safeParse({ ...food, p: '-1' }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, diet: 'vegan' }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, icon: 'pizza' }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, name: '   ' }).success).toBe(false);
  });
  it('reports nested group errors by dotted path', () => {
    const r = foodSchema.safeParse({ ...food, groups: { milk: '-5' } });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)['groups.milk']).toBeTruthy();
  });
});

describe('content schemas', () => {
  it('quotes need 3-200 chars and blank author becomes null', () => {
    expect(quoteSchema.parse({ text: 'Fuel first.', author: '  ', active: true }).author).toBeNull();
    expect(quoteSchema.safeParse({ text: 'Hi' }).success).toBe(false);
    expect(quoteSchema.safeParse({ text: 'x'.repeat(201) }).success).toBe(false);
  });
  it('images are local paths or https URLs', () => {
    expect(imageUrlSchema.safeParse('/img/lunch.webp').success).toBe(true);
    expect(imageUrlSchema.safeParse('https://cdn.example.com/a.jpg').success).toBe(true);
    expect(imageUrlSchema.safeParse('http://insecure.example.com/a.jpg').success).toBe(false);
    expect(imageUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(tourSlideSchema.safeParse({ title: 'Log fast', body: 'Tap plus.', image_url: '' }).success).toBe(false);
  });
});

describe('aiSettingsSchema', () => {
  const base = { enabled: true, photo: true, text: true, plan: false, coach: true };
  it('accepts a quota of 1-200 whole calls', () => {
    expect(aiSettingsSchema.parse({ ...base, daily_quota: '25' }).daily_quota).toBe(25);
    expect(aiSettingsSchema.safeParse({ ...base, daily_quota: 0 }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ ...base, daily_quota: 201 }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ ...base, daily_quota: 2.5 }).success).toBe(false);
  });
});
