import { parseRequest } from '@/lib/ai/contracts';
import { guardAi } from '@/lib/ai/guard';
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

  return suggestFoods({
    feature: 'text',
    supabase: guard.supabase,
    system: PARSE_SYSTEM,
    input: { text: `What the user ate (${body.data.meal}):\n<<<\n${body.data.text}\n>>>` },
    meal: body.data.meal,
    day: body.data.day,
    signal: request.signal,
  });
}
