import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAGS, PRIMARY_KEYS, isOn, mergeFlags, secondaryKeys } from './flags';

describe('mergeFlags', () => {
  it('turns everything on when nothing is stored', () => {
    expect(mergeFlags(null)).toEqual(DEFAULT_FLAGS);
    for (const p of PRIMARY_KEYS) for (const s of secondaryKeys(p)) expect(isOn(DEFAULT_FLAGS, p, s)).toBe(true);
  });

  it('keeps stored booleans, defaults missing keys to on, and drops unknown or bad values', () => {
    const f = mergeFlags({ compare: { on: true, plan: false, nonsense: false }, progress: 'off', water: { on: 'no' }, extra: { on: false } });
    expect(f.compare.plan).toBe(false);
    expect(f.compare.groups).toBe(true);
    expect('nonsense' in f.compare).toBe(false);
    expect(f.progress.on).toBe(true);
    expect(f.water.on).toBe(true);
    expect('extra' in f).toBe(false);
  });
});

describe('isOn', () => {
  it('needs the primary on for any of its secondaries', () => {
    const f = mergeFlags({ compare: { on: false, plan: true } });
    expect(isOn(f, 'compare')).toBe(false);
    expect(isOn(f, 'compare', 'plan')).toBe(false);
  });
  it('respects a secondary switched off under a primary that is on', () => {
    const f = mergeFlags({ apps: { on: true, strava: false } });
    expect(isOn(f, 'apps')).toBe(true);
    expect(isOn(f, 'apps', 'strava')).toBe(false);
    expect(isOn(f, 'apps', 'upcoming')).toBe(true);
  });
});
