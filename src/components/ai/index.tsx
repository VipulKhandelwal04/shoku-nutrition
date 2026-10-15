'use client';
// CONTRACT (owned by the AI workstream). Signatures are fixed.
// Consumers: the signed-in app (Today, Diary, Compare). Every AI result is labelled "AI Assist" and is a suggestion
// the user confirms. Consumers should only render these when getAiAssist().features[x] is true.
export { AiLogSheet, type AiLogSheetProps } from './AiLogSheet';
export { CoachLine } from './CoachLine';
export { PlanTuner } from './PlanTuner';
export { AiBadge } from './AiBadge';
