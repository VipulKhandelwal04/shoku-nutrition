import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { TZ_COOKIE, todayIn, validTimeZone } from './insights';

/** The user's "today" (device time zone via cookie, India time until the cookie is set). */
export async function userToday(): Promise<{ today: string; tz: string | null }> {
  const raw = (await cookies()).get(TZ_COOKIE)?.value ?? null;
  let tz: string | null = null;
  try {
    tz = raw ? validTimeZone(decodeURIComponent(raw)) : null;
  } catch {
    tz = null;
  }
  return { today: todayIn(tz), tz };
}

/** The user's saved Gemini-tailored plan, raw (validated by parseStoredPlan). */
export async function getStoredPlan(): Promise<unknown> {
  const supabase = await createClient();
  const { data } = await supabase.from('user_plans').select('plan').maybeSingle();
  return data?.plan ?? null;
}
