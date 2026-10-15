'use client';
// CONTRACT (owned by the AI workstream). Signatures are fixed; implementations may replace these stubs.
// Consumers: the signed-in app (Today, Diary, Compare). Every AI result is a suggestion the user confirms.
import type { Food, Meal } from '@/lib/nutrition';

export type AiLogSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 'photo' = snap a plate (Gemini vision); 'text' = "2 rotis, dal and curd". */
  mode: 'photo' | 'text';
  day: string; // YYYY-MM-DD the entries are logged to
  meal: Meal; // default meal; the user can change it per item before confirming
  foods: Food[]; // catalogue + custom foods visible to the user (for matching and manual correction)
  /** Called after the user confirms and entries are saved, with the new entry ids (for Undo). */
  onLogged?: (entryIds: string[]) => void;
};
export function AiLogSheet(_props: AiLogSheetProps) {
  return null;
}

/** One short, never-shaming nudge for the day. Renders nothing when coach AI is off or the quota is used up. */
export function CoachLine(_props: { day: string }) {
  return null;
}

/** Entry point to tailor the meal plan with Gemini ("no paneer", "jain"). Saves to user_plans; calls onSaved. */
export function PlanTuner(_props: { onSaved?: () => void }) {
  return null;
}
