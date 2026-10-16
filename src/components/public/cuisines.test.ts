// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { CUISINES, nextCuisine } from './cuisines';
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it('shows every cuisine before repeating and avoids consecutive repeats between rounds', () => {
  let previous = '';
  for (let cycle = 0; cycle < 20; cycle++) {
    const seen = new Set();
    for (let n = 0; n < CUISINES.length; n++) {
      const cuisine = nextCuisine(); expect(cuisine.id).not.toBe(previous);
      seen.add(cuisine.id); previous = cuisine.id;
    }
    expect(seen.size).toBe(CUISINES.length);
  }
});
it('resumes the remaining bag from storage across page loads', () => {
  localStorage.setItem('shoku.home-cuisines.v1', JSON.stringify({ last: 'indian', remaining: ['thai'] }));
  expect(nextCuisine().id).toBe('thai');
});
it('recovers from corrupted data and maintains in-memory rotation if storage is blocked', () => {
  localStorage.setItem('shoku.home-cuisines.v1', '{broken');
  const first = nextCuisine().id;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(nextCuisine().id).not.toBe(first);
});
