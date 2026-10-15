// Sign out (POST only, so a stray link or prefetch can't log anyone out), then go home.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    console.error('[auth/signout] sign-out failed', e);
  }
  // 303 so the browser follows with GET after a form POST.
  return NextResponse.redirect(new URL('/', request.nextUrl.origin), 303);
}
