import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { AiBadResponse, AiCancelled, AiNotConfigured, AiTimeout, AiUpstream } from './gemini';

// JSON envelope shared by every /api/ai route: { ok: true, data } | { ok: false, error }.

export type AiApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<AiApiResult<T>>({ ok: true, data }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(status: number, error: string) {
  return NextResponse.json<AiApiResult<never>>({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export const MSG = {
  signedOut: 'Your session ended. Sign in again to use AI Assist.',
  off: 'AI Assist is turned off right now.',
  featureOff: 'This AI feature is turned off right now.',
  notConfigured: 'AI isn’t set up on this deployment yet.',
  timeout: 'AI Assist took too long to answer. Try again in a moment.',
  busy: 'AI Assist is busy right now. Try again in a minute.',
  bad: 'AI Assist couldn’t make sense of that. Try again, or search manually.',
  quota: (n: number) => `You’ve used today’s ${n} AI suggestions. They refresh at midnight.`,
} as const;

/** Maps AI errors to a friendly status + message. Never includes stack traces, prompts or keys. */
export function errorResponse(err: unknown, feature: string) {
  if (err instanceof AiNotConfigured) return fail(503, MSG.notConfigured);
  if (err instanceof AiTimeout) return fail(504, MSG.timeout);
  if (err instanceof AiCancelled) return fail(499, 'Cancelled.');
  if (err instanceof AiBadResponse) return fail(502, MSG.bad);
  if (err instanceof AiUpstream) {
    console.error(`[ai:${feature}] upstream ${err.status}`);
    // Overload and outages are "busy", not the user's input: say so, so people retry instead of rewording.
    const busy = err.status === 429 || err.status >= 500 || err.status === 0;
    return fail(502, busy ? MSG.busy : MSG.bad); // 502 stays retryable in the UI (503 means "not set up")
  }
  console.error(`[ai:${feature}] ${err instanceof Error ? err.name : 'unknown error'}`);
  return fail(500, 'Something went wrong with AI Assist. Try again.');
}

/** Reads and validates a JSON body. Returns the parsed data or a 400 response. */
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail(400, 'Send a JSON body.') };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, response: fail(400, r.error.issues[0]?.message ?? 'Check your request.') };
  return { ok: true, data: r.data };
}

/** Today's date key in India time, matching ai_calls_today() and the app's day boundaries. */
export function todayIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
