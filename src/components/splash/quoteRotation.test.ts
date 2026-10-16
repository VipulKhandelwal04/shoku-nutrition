// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { bootSplash, splashBootScript } from './quoteRotation';

function mount(keys = ['a', 'b', 'c']) {
  document.body.innerHTML = '<div id="splash"></div>';
  const el = document.getElementById('splash')!;
  for (const key of keys) {
    const quote = document.createElement('blockquote');
    quote.dataset.quoteKey = key;
    el.append(quote);
  }
  return el;
}
function launch(keys?: string[], inline = false) {
  sessionStorage.clear();
  const el = mount(keys);
  if (inline) new Function(splashBootScript('splash', 'test'))();
  else bootSplash('splash', 'test');
  const visible = [...el.children].filter(n => !(n as HTMLElement).hidden);
  expect(visible).toHaveLength(1);
  return (visible[0] as HTMLElement).dataset.quoteKey!;
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());
it('exhausts each bag, persists across sessions and never repeats at boundaries', () => {
  let last = '';
  for (let cycle = 0; cycle < 100; cycle++) {
    const round = [];
    for (let n = 0; n < 3; n++) {
      const value = launch(undefined, n % 2 === 0);
      expect(value).not.toBe(last);
      round.push(value); last = value;
    }
    expect(new Set(round).size).toBe(3);
  }
});
it('does not consume twice when hydration/Strict Mode repeats initialization', () => {
  launch();
  const saved = localStorage.getItem('test:quotes:v1');
  bootSplash('splash', 'test');
  expect(localStorage.getItem('test:quotes:v1')).toBe(saved);
});
it('does not consume a quote when the session already saw the splash', () => {
  launch();
  const saved = localStorage.getItem('test:quotes:v1');
  const el = mount();
  bootSplash('splash', 'test');
  expect(el.dataset.seen).toBe('1');
  expect(el.dataset.q).toBeUndefined();
  expect(localStorage.getItem('test:quotes:v1')).toBe(saved);
});
it('preserves progress when admin ordering changes', () => {
  const round = [launch(), launch(['c', 'a', 'b']), launch(['b', 'c', 'a'])];
  expect(new Set(round).size).toBe(3);
});
it('rebuilds a changed pool without repeating the previous quote', () => {
  const last = launch();
  expect(launch([last, 'new'])).toBe('new');
});
it('handles singleton and empty pools', () => {
  expect(launch(['only'])).toBe('only');
  expect(launch(['only'])).toBe('only');
  sessionStorage.clear();
  const el = mount([]);
  expect(() => bootSplash('splash', 'test')).not.toThrow();
  expect(el.dataset.q).toBeUndefined();
});
it.each(['{bad', 'null', '{"remaining":42}', '{"signature":"[\\"a\\",\\"b\\",\\"c\\"]","remaining":["invalid"],"last":"a"}'])('recovers from damaged state: %s', value => {
  localStorage.setItem('test:quotes:v1', value);
  expect(['a', 'b', 'c']).toContain(launch());
});
it('still renders when storage is blocked', () => {
  mount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => new Function(splashBootScript('splash', 'test'))()).not.toThrow();
  expect(document.getElementById('splash')!.dataset.q).toMatch(/^[0-2]$/);
});
it('escapes custom storage keys in inline HTML', () => {
  expect(splashBootScript('splash', '</script><script>')).not.toContain('</script>');
});
