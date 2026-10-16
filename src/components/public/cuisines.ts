export const CUISINES = [
  { id: 'indian', name: 'Indian', dish: 'A little of everything', alt: 'Indian thali with dal, paneer, rice and roti' },
  { id: 'japanese', name: 'Japanese', dish: 'Balance in a bowl', alt: 'Japanese soba noodles with mushrooms and vegetables' },
  { id: 'mediterranean', name: 'Mediterranean', dish: 'Fresh and familiar', alt: 'Mediterranean hummus, tabbouleh, pita and vegetables' },
  { id: 'mexican', name: 'Mexican', dish: 'Full of colour', alt: 'Mexican black bean tacos with avocado and salsa' },
  { id: 'thai', name: 'Thai', dish: 'Find your flavour', alt: 'Thai vegetable curry with jasmine rice' },
  { id: 'italian', name: 'Italian', dish: 'Make it your own', alt: 'Italian tomato and basil pasta with grilled vegetables' },
] as const;
const KEY = 'shoku.home-cuisines.v1';
let memory: { remaining: string[]; last: string } = { remaining: [], last: '' };

/** Separate from splash history: each home visit draws, even when the splash is skipped. */
export function nextCuisine() {
  const ids: string[] = CUISINES.map(c => c.id);
  let state = memory;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.last === 'string' && Array.isArray(saved.remaining) &&
      saved.remaining.every((id: unknown, index: number) => typeof id === 'string' && ids.includes(id) && id !== saved.last && saved.remaining.indexOf(id) === index)) state = saved;
  } catch { /* Use memory when persistent storage is blocked or corrupt. */ }
  const remaining = state.remaining.slice();
  if (!remaining.length) {
    remaining.push(...ids);
    for (let n = remaining.length - 1; n > 0; n--) {
      const j = Math.floor(Math.random() * (n + 1));
      [remaining[n], remaining[j]] = [remaining[j], remaining[n]];
    }
    if (remaining[remaining.length - 1] === state.last) {
      const j = Math.floor(Math.random() * (remaining.length - 1));
      [remaining[j], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[j]];
    }
  }
  const last = remaining.pop()!;
  memory = { remaining, last };
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* In-memory rotation still works. */ }
  return CUISINES.find(c => c.id === last)!;
}
