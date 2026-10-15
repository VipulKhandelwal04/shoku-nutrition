'use client';
import { createBrowserClient } from '@supabase/ssr';

/** Browser Supabase client (used for OAuth sign-in and direct storage uploads). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
