import { parseRequest } from '@/lib/ai/contracts';
import { guardAi, reserveAi } from '@/lib/ai/guard';
import { readJson } from '@/lib/ai/http';
import { PARSE_SYSTEM } from '@/lib/ai/prompts';
import { suggestFoods } from '@/lib/ai/suggest';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST { text (≤ 300 chars), meal, day } → { ok: true, data: SuggestResponse }. "2 rotis, dal and a katori of curd". */
export async function POST(request: Request) {
  const guard = await guardAi('text');
  if (!guard.ok) return guard.response;
  const body = await readJson(request, parseRequest);
  if (!body.ok) return body.response;

  const reservation = await reserveAi(guard.supabase, 'text', guard.settings.daily_quota);
  if (!reservation.ok) return reservation.response;

  return suggestFoods({
    feature: 'text',
    supabase: guard.supabase,
    usageId: reservation.usageId,
    system: PARSE_SYSTEM,
    input: { text: `What the user ate (${body.data.meal}):\n<<<\n${body.data.text}\n>>>` },
    meal: body.data.meal,
    day: body.data.day,
    signal: request.signal,
  });
}
