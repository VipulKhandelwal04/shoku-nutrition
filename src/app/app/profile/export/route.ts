import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// "Download my data": everything the user owns, read as the user (RLS applies). No service key involved.
const PAGE = 1000; // PostgREST's default max rows per request

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: 'Sign in to download your data.' }, { status: 401 });

  async function all(table: 'entries' | 'days', order: string) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', user!.id).order(order).range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < PAGE) return rows;
    }
  }

  try {
    const [profile, foods, plan, badges, entries, days] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('foods').select('*').eq('owner_id', user.id).order('name'),
      supabase.from('user_plans').select('plan, note, updated_at').maybeSingle(),
      supabase.from('user_badges').select('badge, awarded_at'),
      all('entries', 'created_at'),
      all('days', 'day'),
    ]);
    for (const r of [profile, foods, plan, badges]) if (r.error) throw new Error(r.error.message);

    const body = {
      exported_at: new Date().toISOString(),
      app: 'Katori',
      profile: profile.data,
      entries,
      days,
      custom_foods: foods.data ?? [],
      meal_plan: plan.data ?? null,
      badges: badges.data ?? [],
    };
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="katori-data-${stamp}.json"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[katori] data export failed', e);
    return NextResponse.json({ error: 'Couldn’t build your export. Try again in a moment.' }, { status: 500 });
  }
}
