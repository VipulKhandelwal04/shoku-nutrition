import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Privileged client ONLY for Strava token RPCs. Callers must supply a verified, active user's id. */
export function stravaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Strava server credentials are not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
