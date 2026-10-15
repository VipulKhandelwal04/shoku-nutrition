import 'server-only';
// Groq: the backup for AI Assist when every Gemini model is overloaded or failing. Text only (photos stay with
// Gemini). Groq's API is OpenAI-compatible; JSON mode plus the schema in the instructions, and the caller still
// validates the answer with zod. The key stays on the server and is never logged.

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export function groqModel(): string {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

/** Groq answered with an HTTP error. */
export class GroqError extends Error {
  constructor(public status: number, reason: string) { super(`Groq ${status}: ${reason}`); this.name = 'GroqError'; }
}

/** The request body for a JSON answer that fits `jsonSchema`. Pure, so it is tested. */
export function groqRequest(opts: { system: string; text: string; jsonSchema: Record<string, unknown>; temperature: number; model?: string }) {
  return {
    model: opts.model ?? groqModel(),
    messages: [
      {
        role: 'system',
        content: `${opts.system}\n\nReply with ONLY one JSON object that matches this JSON Schema exactly (no prose, no code fences):\n${JSON.stringify(opts.jsonSchema)}`,
      },
      { role: 'user', content: opts.text },
    ],
    response_format: { type: 'json_object' },
    temperature: opts.temperature,
    max_completion_tokens: 8000,
  };
}

/** Groq's own reason from an error body, with anything that looks like a key masked. */
export function groqReason(body: string): string {
  let msg = body;
  try {
    const j = JSON.parse(body) as { error?: { message?: string } };
    if (j.error?.message) msg = j.error.message;
  } catch { /* plain text */ }
  return msg.replace(/gsk_[0-9A-Za-z]{10,}/g, '[key]').replace(/\s+/g, ' ').slice(0, 240);
}

/** Asks Groq for JSON; returns the raw text for the caller to parse and validate. */
export async function groqJson(opts: { system: string; text: string; jsonSchema: Record<string, unknown>; temperature: number; signal: AbortSignal }): Promise<string | undefined> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(groqRequest(opts)),
    signal: opts.signal,
    cache: 'no-store',
  });
  if (!res.ok) throw new GroqError(res.status, groqReason(await res.text()));
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? undefined;
}
