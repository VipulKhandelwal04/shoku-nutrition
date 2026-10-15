-- Save and edit your week (#9): one saved day plan per member per weekday (1 = Monday … 7 = Sunday).
-- A saved weekday replaces the generated day in the week view. The single day plan (user_plans) stays and still
-- seeds the week; nothing is migrated away. Additive: a new table.
create table public.week_plans (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, weekday)
);
alter table public.week_plans enable row level security;
create policy "week_plans: own rows" on public.week_plans for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
