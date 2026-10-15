import 'server-only';
import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from '@google/genai';
import { z } from 'zod';
import { GroqError, groqJson, groqModel, isGroqConfigured } from './groq';

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

/**
 * Models to try in order. The main Flash model is often "experiencing high demand" (503); Flash-Lite is fast and
 * rarely overloaded, so it is the fallback. It is pinned to a stable version: the "-latest" alias is swapped by Google
 * on each release, and in Oct 2026 it rejected our requests with a bare 400. Override with GEMINI_FALLBACK_MODEL
 * (empty = none).
 */
export function aiModels(): string[] {
  const fallback = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash-lite';
  return [...new Set([aiModel(), fallback].filter(Boolean))];
}

/** Statuses where another model (or a moment later) may succeed. */
const RETRYABLE = new Set([429, 500, 503, 504]);

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

  const models = aiModels();
  let lastUpstream: AiUpstream | null = null;
  let thinking = true;

  // Walk the model chain; each model gets one JSON-validation retry. Overload (503/429) moves to the next model.
  for (let m = 0; m < models.length; m++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let text: string | undefined;
      try {
        const res = await ai.models.generateContent({
          model: models[m],
          contents: [{ role: 'user', parts: opts.parts }],
          config: {
            systemInstruction: opts.system,
            responseMimeType: 'application/json',
            responseJsonSchema,
            temperature: opts.temperature ?? 0.2,
            // Low thinking keeps answers in a few seconds instead of ~20s. Dropped if a model rejects it.
            ...(thinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            abortSignal: signal,
          },
        });
        text = res.text;
      } catch (err) {
        if (opts.signal?.aborted) throw new AiCancelled();
        if (deadline.aborted || isAbort(err)) throw new AiTimeout();
        const status = err instanceof ApiError ? err.status : 0;
        // Not every model takes thinkingLevel, and some reject it with a bare "invalid argument" (seen on the
        // flash-lite fallback). Any 400 while it is on: drop it once and ask the same model again.
        if (status === 400 && thinking) {
          console.warn(`[ai] ${models[m]} 400 with thinkingLevel; retrying without it: ${upstreamReason(err)}`);
          thinking = false;
          attempt--;
          continue;
        }
        const reason = upstreamReason(err);
        console.error(`[ai] ${models[m]} upstream ${status}: ${reason}`);
        // A rejected key is a setup problem, not the user's input: say "not set up" instead of "try rewording".
        if (/api[ _]?key/i.test(reason)) throw new AiNotConfigured();
        // The main model took this request and was only busy, so a 400 from a fallback means that model can't take
        // something we send, not that the request is bad. Keep the "busy" status and move on (next model, then Groq).
        if (status === 400 && lastUpstream) break;
        lastUpstream = new AiUpstream(status);
        if (RETRYABLE.has(status)) break; // next model
        throw lastUpstream;
      }
      const parsed = parseJson(text, schema);
      if (parsed.ok) return parsed.data;
      // Only retry while there is a realistic amount of time left.
      if (Date.now() - started > timeoutMs - 6_000) throw new AiBadResponse();
    }
  }
  // Every Gemini model was overloaded or failing: the Groq backup takes text requests (photos stay with Gemini).
  const text = textOnly(opts.parts);
  if (isGroqConfigured() && text !== null && lastUpstream && RETRYABLE.has(lastUpstream.status)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await groqJson({ system: opts.system, text, jsonSchema: responseJsonSchema, temperature: opts.temperature ?? 0.2, signal });
        const parsed = parseJson(out, schema);
        if (parsed.ok) {
          console.warn(`[ai] answered by Groq backup (${groqModel()}) after Gemini ${lastUpstream.status}`);
          return parsed.data;
        }
      } catch (err) {
        if (opts.signal?.aborted) throw new AiCancelled();
        if (deadline.aborted || isAbort(err)) throw new AiTimeout();
        console.error(`[ai] groq ${groqModel()} ${err instanceof GroqError ? err.message : 'request failed'}`);
        break;
      }
      if (Date.now() - started > timeoutMs - 6_000) break;
    }
  }
  if (lastUpstream) throw lastUpstream;
  throw new AiBadResponse();
}

/** The request as one text, or null when it carries an image (only Gemini takes photos). */
export function textOnly(parts: Part[]): string | null {
  if (parts.some(p => !p.text && (p.inlineData || p.fileData))) return null;
  return parts.map(p => p.text ?? '').filter(Boolean).join('\n\n');
}

/**
 * Gemini's own one-line reason (e.g. "API key not valid", "Invalid JSON payload"), so a 400 in the logs says why.
 * Gemini never echoes the key; anything that looks like one is masked anyway.
 */
export function upstreamReason(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let msg = raw;
  try {
    const j = JSON.parse(raw.slice(raw.indexOf('{'))) as { error?: { message?: string; status?: string } };
    if (j.error?.message) msg = `${j.error.status ?? ''} ${j.error.message}`.trim();
  } catch { /* not JSON: keep the plain message */ }
  return msg.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[key]').replace(/\s+/g, ' ').slice(0, 240);
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
