/** Self-contained: also serialized into the pre-paint script. Keep dependencies inside this function. */
export function bootSplash(id: string, storageKey: string): void {
  const el = document.getElementById(id);
  if (!el || el.hasAttribute('data-seen')) return;
  let seen = false;
  try {
    seen = sessionStorage.getItem(storageKey) === '1';
    sessionStorage.setItem(storageKey, '1');
  } catch { /* Storage restrictions must never block entry. */ }
  el.setAttribute('data-seen', seen ? '1' : '0');
  if (seen) return; // Hidden launches must not consume a quote.

  const nodes = el.querySelectorAll('[data-quote-key]');
  const keys: string[] = [];
  for (let n = 0; n < nodes.length; n++) keys.push(nodes[n].getAttribute('data-quote-key') || '');
  if (!keys.length) return;
  const signature = JSON.stringify(keys.slice().sort());
  const key = storageKey + ':quotes:v1';
  let remaining: string[] = [];
  let last = '';
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved.last === 'string') last = saved.last;
    if (saved && saved.signature === signature && Array.isArray(saved.remaining)) {
      const candidate = saved.remaining;
      if (candidate.length <= keys.length && candidate.every((value: unknown, index: number) =>
        typeof value === 'string' && keys.indexOf(value) !== -1 && candidate.indexOf(value) === index && value !== last
      )) remaining = candidate;
    }
  } catch { /* Corrupt or unavailable storage starts a fresh bag. */ }
  if (!remaining.length) {
    remaining = keys.slice();
    for (let n = remaining.length - 1; n > 0; n--) {
      const j = Math.floor(Math.random() * (n + 1));
      const swap = remaining[n]; remaining[n] = remaining[j]; remaining[j] = swap;
    }
    // Draw from the end; never repeat across a cycle or catalogue change.
    if (remaining.length > 1 && remaining[remaining.length - 1] === last) {
      const j = Math.floor(Math.random() * (remaining.length - 1));
      const swap = remaining[j]; remaining[j] = last; remaining[remaining.length - 1] = swap;
    }
  }
  const selected = remaining.pop()!;
  const index = keys.indexOf(selected);
  try { localStorage.setItem(key, JSON.stringify({ signature, remaining, last: selected })); } catch { /* Best effort. */ }
  el.setAttribute('data-q', String(index));
  for (let n = 0; n < nodes.length; n++) (nodes[n] as HTMLElement).hidden = n !== index;
}

export function splashBootScript(id: string, storageKey: string): string {
  // Escape '<' so even a custom storage key cannot terminate the HTML script element.
  const args = JSON.stringify([id, storageKey]).replace(/</g, '\\u003c');
  return '(' + bootSplash.toString() + ').apply(null,' + args + ');';
}
