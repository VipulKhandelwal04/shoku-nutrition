import { coachOutput, coachRequest, type CoachResponse } from '@/lib/ai/contracts';
import { coachSummary, fallbackLine, isUnsafeLine, tidyLine } from '@/lib/ai/coach';
import { generateJson } from '@/lib/ai/gemini';
import { guardAi, recordUsage } from '@/lib/ai/guard';
import { errorResponse, fail, ok, readJson, todayIst } from '@/lib/ai/http';
import { COACH_SYSTEM } from '@/lib/ai/prompts';
import type { EntryRow, Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST { day } → { ok: true, data: { line, ai } }. The summary is computed here from the user's own entries
 * (totals + groupStatus vs targets); the client sends nothing else. Empty days get a built-in line (no AI call).
 */
export async function POST(request: Request) {
  const guard = await guardAi('coach');
  if (!guard.ok) return guard.response;
  const body = await readJson(request, coachRequest);
  if (!body.ok) return body.response;
  const { day } = body.data;

  const [{ data: profile }, { data: entries, error }] = await Promise.all([
    guard.supabase.from('profiles').select('targets').eq('id', guard.user.id).maybeSingle<Pick<Profile, 'targets'>>(),
    guard.supabase.from('entries').select('meal, food, quantity').eq('day', day),
  ]);
  if (!profile?.targets) return fail(409, 'Finish setting up your goal first.');
  if (error) return fail(500, 'Couldn’t read your diary. Try again.');

  const dayOpen = day >= todayIst();
  const summary = coachSummary((entries ?? []) as Pick<EntryRow, 'meal' | 'food' | 'quantity'>[], profile.targets, dayOpen);
  if (!summary.mealsLogged.length) return ok<CoachResponse>({ line: fallbackLine(summary), ai: false });

  let success = false;
  try {
    const out = await generateJson(coachOutput, {
      system: COACH_SYSTEM,
      parts: [{ text: JSON.stringify(summary) }],
      temperature: 0.8,
      timeoutMs: 15_000,
      signal: request.signal,
    });
    success = true;
    const line = tidyLine(out.line);
    if (!line || isUnsafeLine(line)) return ok<CoachResponse>({ line: fallbackLine(summary), ai: false });
    return ok<CoachResponse>({ line, ai: true });
  } catch (err) {
    return errorResponse(err, 'coach');
  } finally {
    await recordUsage(guard.supabase, 'coach', success);
  }
}
