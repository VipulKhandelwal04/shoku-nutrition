-- How it felt (#6): members rate a logged meal or an Ask Shoku idea. Own rows only; included in "Download my data".
-- Additive: a new table, nothing existing changes.
create table public.meal_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The logged entry that was rated; null for an idea. The snapshot below keeps the rating readable if the entry goes.
  entry_id uuid references public.entries(id) on delete set null,
  kind text not null check (kind in ('entry', 'idea')),
  title text not null check (char_length(title) between 1 and 120),
  meal text not null check (meal in ('Breakfast', 'Lunch', 'Snacks', 'Dinner')),
  food_ids text[] not null default '{}' check (cardinality(food_ids) <= 12),
  rating text not null check (rating in ('like', 'okay', 'no')),
  tags text[] not null default '{}'
    check (tags <@ array['loved_it', 'too_heavy', 'too_light', 'too_long', 'not_my_cuisine']::text[]),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index meal_feedback_user_idx on public.meal_feedback (user_id, created_at desc);
-- One rating per logged entry; rating it again replaces the old one.
create unique index meal_feedback_entry_idx on public.meal_feedback (entry_id) where entry_id is not null;

alter table public.meal_feedback enable row level security;
create policy "meal_feedback: own rows" on public.meal_feedback for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (entry_id is null or exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid()))
  );
