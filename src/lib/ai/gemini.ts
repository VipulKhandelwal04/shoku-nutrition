import 'server-only';
import { ApiError, GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';

// Server-only Gemini access for AI Assist. The key never leaves the server and is never logged.

export class AiNotConfigured extends Error {
  constructor() { super('GEMINI_API_KEY is not set'); this.name = 'AiNotConfigured'; }
}
export class AiTimeout extends Error {
  constructor() { super('Gemini timed out'); this.name = 'AiTimeout'; }
}
/** The model answered, but not with JSON that fits the schema (after one retry). */
export class AiBadResponse extends Error {
  constructor(message = 'Gemini returned an unusable response') { super(message); this.name = 'AiBadResponse'; }
}
/** Gemini itself failed (rate limit, bad key, outage). `status` is Gemini's HTTP status. */
export class AiUpstream extends Error {
  constructor(public status: number) { super(`Gemini error ${status}`); this.name = 'AiUpstream'; }
}
/** The caller (browser) went away; nothing to answer. */
export class AiCancelled extends Error {
  constructor() { super('Request cancelled'); this.name = 'AiCancelled'; }
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiNotConfigured();
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export function aiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-flash-latest';
}

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** JSON Schema for Gemini's responseJsonSchema (drops the $schema marker, which the API does not need). */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  void _drop;
  return rest;
}

export const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Asks Gemini for JSON that matches `schema`, validates it with zod, and retries once on invalid JSON.
 * One deadline covers both attempts. `signal` (the incoming request's) cancels early when the user leaves.
 */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  opts: { system: string; parts: Part[]; timeoutMs?: number; temperature?: number; signal?: AbortSignal },
): Promise<T> {
  const ai = getClient();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = opts.signal ? AbortSignal.any([deadline, opts.signal]) : deadline;
  const started = Date.now();
  const responseJsonSchema = jsonSchemaFor(schema);

  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string | undefined;
    try {
      const res = await ai.models.generateContent({
        model: aiModel(),
        contents: [{ role: 'user', parts: opts.parts }],
        config: {
          systemInstruction: opts.system,
          responseMimeType: 'application/json',
          responseJsonSchema,
          temperature: opts.temperature ?? 0.2,
          abortSignal: signal,
        },
      });
      text = res.text;
    } catch (err) {
      if (opts.signal?.aborted) throw new AiCancelled();
      if (deadline.aborted || isAbort(err)) throw new AiTimeout();
      if (err instanceof ApiError) throw new AiUpstream(err.status);
      throw new AiUpstream(0);
    }
    const parsed = parseJson(text, schema);
    if (parsed.ok) return parsed.data;
    // Only retry while there is a realistic amount of time left.
    if (Date.now() - started > timeoutMs - 6_000) break;
  }
  throw new AiBadResponse();
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

export function parseJson<T>(text: string | undefined, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false } {
  if (!text) return { ok: false };
  let raw: unknown;
  try {
    // Tolerate a stray ```json fence even though JSON mode should not add one.
    raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ok: false };
  }
  const r = schema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false };
}
