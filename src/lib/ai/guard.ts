import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { getAiSettings } from '../data/queries';
import { createClient } from '../supabase/server';
import type { AiFeature, AiSettings } from '../types';
import { isAiConfigured } from './gemini';
import { MSG, fail } from './http';

export type AiGuard =
  | { ok: true; supabase: SupabaseClient; user: User; settings: AiSettings }
  | { ok: false; response: NextResponse };

/**
 * Gate for every AI Assist route, in order: signed in → master flag on → feature flag on → Gemini key present
 * → under today's quota. Returns the user's Supabase client (RLS applies) or a ready error response.
 */
export async function guardAi(feature: AiFeature): Promise<AiGuard> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, response: fail(401, MSG.signedOut) };

  const settings = await getAiSettings();
  if (!settings.enabled) return { ok: false, response: fail(403, MSG.off) };
  if (!settings[feature]) return { ok: false, response: fail(403, MSG.featureOff) };
  if (!isAiConfigured()) return { ok: false, response: fail(503, MSG.notConfigured) };

  const { data: used, error } = await supabase.rpc('ai_calls_today');
  if (error) {
    console.error(`[ai:${feature}] quota check failed`);
    return { ok: false, response: fail(503, 'AI Assist can’t check your daily limit right now. Try again shortly.') };
  }
  if (typeof used === 'number' && used >= settings.daily_quota) {
    return { ok: false, response: fail(429, MSG.quota(settings.daily_quota)) };
  }
  return { ok: true, supabase, user: data.user, settings };
}

/** Counts one call (successful or not) toward the user's quota. Never throws: recording must not block a reply. */
export async function recordUsage(supabase: SupabaseClient, feature: AiFeature, ok: boolean): Promise<void> {
  try {
    const { error } = await supabase.from('ai_usage').insert({ feature, ok });
    if (error) console.error(`[ai:${feature}] usage not recorded`);
  } catch {
    console.error(`[ai:${feature}] usage not recorded`);
  }
}
