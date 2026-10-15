-- Meal-idea preferences on the member's profile: cuisines (#4) and activity context (#5).
-- Additive: every existing member keeps today's behaviour (open to all cuisines, workouts used, no extra question).
alter table public.profiles
  add column if not exists cuisine_mode text not null default 'open' check (cuisine_mode in ('open', 'familiar', 'chosen')),
  add column if not exists cuisines text[] not null default '{}' check (cardinality(cuisines) <= 12),
  add column if not exists use_workouts boolean not null default true,
  add column if not exists ask_workouts boolean not null default false;
