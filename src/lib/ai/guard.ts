import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { getAiSettings } from '../data/queries';
import { actionUser } from '../auth';
import type { AiFeature, AiSettings } from '../types';
import { isAiConfigured } from './gemini';
import { MSG, fail } from './http';

export type AiGuard =
  | { ok: true; supabase: SupabaseClient; user: User; settings: AiSettings }
  | { ok: false; response: NextResponse };

/**
 * Gate for every AI Assist route, in order: signed in → master flag on → feature flag on → Gemini key present
 * Returns the user's Supabase client (RLS applies) or a ready error response.
 */
export async function guardAi(feature: AiFeature): Promise<AiGuard> {
  const session = await actionUser();
  if (!session) return { ok: false, response: fail(401, MSG.signedOut) };
  const { supabase, user } = session;

  const settings = await getAiSettings();
  if (!settings.enabled) return { ok: false, response: fail(403, MSG.off) };
  if (!settings[feature]) return { ok: false, response: fail(403, MSG.featureOff) };
  if (!isAiConfigured()) return { ok: false, response: fail(503, MSG.notConfigured) };

  return { ok: true, supabase, user, settings };
}

/** Reserve immediately before generation, after validation and any non-AI fallback. */
export async function reserveAi(supabase: SupabaseClient, feature: AiFeature, dailyQuota: number): Promise<
  { ok: true; usageId: number } | { ok: false; response: NextResponse }
> {
  const { data: usageId, error } = await supabase.rpc('reserve_ai_call', { p_feature: feature });
  if (error) {
    console.error(`[ai:${feature}] quota check failed`);
    return { ok: false, response: fail(503, 'AI Assist can’t check your daily limit right now. Try again shortly.') };
  }
  if (usageId === null) {
    return { ok: false, response: fail(429, MSG.quota(dailyQuota)) };
  }
  if (typeof usageId !== 'number') return { ok: false, response: fail(503, 'AI Assist could not reserve your request. Try again.') };
  return { ok: true, usageId };
}

/** Finalizes an already-counted reservation. Failures and abandoned requests still consume quota. */
export async function recordUsage(supabase: SupabaseClient, feature: AiFeature, ok: boolean, usageId: number): Promise<void> {
  try {
    const { error } = await supabase.rpc('finish_ai_call', { p_id: usageId, p_ok: ok });
    if (error) console.error(`[ai:${feature}] usage not recorded`);
  } catch {
    console.error(`[ai:${feature}] usage not recorded`);
  }
}
