// Pure helpers for the AI Assist coach line: the day summary the model sees, and a safety pass on what it says.
import { MEALS, groupStatus, totals, type Entry, type Targets } from '../nutrition';

export const COACH_MAX = 110;

export type CoachSummary = {
  dayOpen: boolean;
  mealsLogged: string[];
  mealsMissing: string[];
  kcal: { eaten: number; target: number };
  protein: { eaten: number; target: number };
  fibre: number;
  groups: { label: string; status: string; eaten: number; target: number; unit: string }[];
};

export function coachSummary(entries: Pick<Entry, 'meal' | 'food' | 'quantity'>[], targets: Targets, dayOpen: boolean): CoachSummary {
  const t = totals(entries);
  const logged = MEALS.filter(m => entries.some(e => e.meal === m));
  return {
    dayOpen,
    mealsLogged: logged,
    mealsMissing: MEALS.filter(m => !logged.includes(m)),
    kcal: { eaten: Math.round(t.kcal), target: targets.kcal },
    protein: { eaten: Math.round(t.p), target: targets.p },
    fibre: Math.round(t.fibre),
    groups: groupStatus(entries, targets.kcal, dayOpen).map(g => ({ label: g.label, status: g.status, eaten: g.eaten, target: g.target, unit: g.unit })),
  };
}

const UNSAFE = /\b(diabet\w*|disease|cure[sd]?|treat(s|ment)?|medic\w*|prescri\w*|insulin|cholesterol|blood pressure|hypertension|thyroid|pcos|detox|cancer|starv\w*|skip (a |your )?meal|fat(ty)? ?shame|lazy|bad|fail\w*|guilt\w*|shame\w*)\b/i;

/** One clean line: no quotes or line breaks, at most 110 chars, cut at a word boundary. */
export function tidyLine(raw: string): string {
  let s = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (s.length > COACH_MAX) {
    const cut = s.slice(0, COACH_MAX - 1);
    const sp = cut.lastIndexOf(' ');
    s = `${(sp > 60 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
  }
  return s;
}

/** True when the line strays into medical claims or shaming words; the route then uses a safe fallback. */
export function isUnsafeLine(s: string): boolean {
  return UNSAFE.test(s);
}

/** Deterministic, never-shaming line used for empty days and when the model's line fails the safety pass. */
export function fallbackLine(summary: Pick<CoachSummary, 'mealsLogged' | 'mealsMissing' | 'dayOpen'>): string {
  if (!summary.mealsLogged.length) return 'Nothing logged yet. After your first meal, this line suggests what the day still needs.';
  if (summary.dayOpen && summary.mealsMissing.length) return `${summary.mealsLogged.length} meal${summary.mealsLogged.length > 1 ? 's' : ''} in. Keep stacking: ${summary.mealsMissing[0].toLowerCase()} is next.`;
  return 'Every logged meal is a rep. Nice work showing up today.';
}
