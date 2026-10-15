-- Katori: initial schema. Every user-owned table is protected by row-level security.
-- Admins manage catalogue/content/settings, and see aggregate user stats only, never anyone's diary.

create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------- Profiles & roles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  disabled boolean not null default false,
  goal text check (goal in ('lose', 'fit', 'muscle')),
  sex text check (sex in ('female', 'male')),
  age int check (age between 18 and 100),
  height_cm numeric check (height_cm between 120 and 230),
  weight_kg numeric check (weight_kg between 30 and 300),
  activity text check (activity in ('sedentary', 'light', 'moderate', 'high')),
  diet text not null default 'veg' check (diet in ('veg', 'egg', 'nonveg')),
  restrictions text[] not null default '{}',
  targets jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Emails that become admin on first sign-in. Lives in a non-exposed schema; filled per deployment, never committed.
create table private.admin_emails (email text primary key);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not disabled);
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    case when exists (select 1 from private.admin_emails a where lower(a.email) = lower(new.email)) then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users can edit their own profile but never their own role or disabled flag.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.disabled is distinct from old.disabled) and not public.is_admin() then
    raise exception 'Only an admin can change roles or account status';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;
create policy "profiles: read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own or admin" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- ---------- Food catalogue (owner_id null = shared catalogue; set = a user's custom food) ----------
create table public.foods (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'Custom',
  unit text not null check (char_length(unit) between 1 and 40),
  grams numeric not null check (grams > 0 and grams <= 5000),
  kcal numeric not null check (kcal >= 0 and kcal <= 10000),
  p numeric not null default 0 check (p >= 0),
  c numeric not null default 0 check (c >= 0),
  f numeric not null default 0 check (f >= 0),
  fibre numeric not null default 0 check (fibre >= 0),
  diet text not null default 'veg' check (diet in ('veg', 'egg', 'nonveg')),
  icon text not null default 'bowl',
  aliases text not null default '',
  groups jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index foods_owner_idx on public.foods (owner_id);

alter table public.foods enable row level security;
create policy "foods: read catalogue, own, or admin" on public.foods for select
  using ((owner_id is null and active) or owner_id = auth.uid() or public.is_admin());
create policy "foods: create own custom or admin catalogue" on public.foods for insert
  with check ((owner_id = auth.uid()) or (owner_id is null and public.is_admin()));
create policy "foods: edit own custom or admin catalogue" on public.foods for update
  using (owner_id = auth.uid() or (owner_id is null and public.is_admin()));
create policy "foods: delete own custom or admin catalogue" on public.foods for delete
  using (owner_id = auth.uid() or (owner_id is null and public.is_admin()));

-- ---------- Diary ----------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  meal text not null check (meal in ('Breakfast', 'Lunch', 'Snacks', 'Dinner')),
  food_id text references public.foods(id) on delete set null,
  food jsonb not null,               -- snapshot at log time, so later catalogue edits don't rewrite history
  quantity numeric not null check (quantity > 0 and quantity <= 100),
  photo_path text,
  source text not null default 'manual' check (source in ('manual', 'quick', 'repeat', 'plan', 'photo_ai', 'text_ai')),
  created_at timestamptz not null default now()
);
create index entries_user_day_idx on public.entries (user_id, day);

alter table public.entries enable row level security;
create policy "entries: own rows" on public.entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  water_ml int not null default 0 check (water_ml between 0 and 15000),
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.days enable row level security;
create policy "days: own rows" on public.days for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Gemini-tailored plan (null = use the deterministic template)
create table public.user_plans (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  plan jsonb not null,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.user_plans enable row level security;
create policy "user_plans: own row" on public.user_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Badges are recorded once so the unlock moment never re-fires after edits.
create table public.user_badges (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  badge text not null check (badge in ('starter', 'week-warrior', 'fortnight-force', 'thirty-club')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
create policy "user_badges: read own" on public.user_badges for select using (user_id = auth.uid());
create policy "user_badges: add own" on public.user_badges for insert with check (user_id = auth.uid());

-- ---------- Public content (splash quotes, home tour) ----------
create table public.quotes (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 3 and 200),
  author text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.quotes enable row level security;
create policy "quotes: public read active" on public.quotes for select using (active or public.is_admin());
create policy "quotes: admin write" on public.quotes for all using (public.is_admin()) with check (public.is_admin());

create table public.tour_slides (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 3 and 280),
  image_url text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.tour_slides enable row level security;
create policy "tour: public read active" on public.tour_slides for select using (active or public.is_admin());
create policy "tour: admin write" on public.tour_slides for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Settings & AI usage ----------
-- Only non-secret values belong here: it is readable by everyone.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.app_settings enable row level security;
create policy "settings: public read" on public.app_settings for select using (true);
create policy "settings: admin write" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  feature text not null check (feature in ('photo', 'text', 'plan', 'coach')),
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
create policy "ai_usage: read own or admin" on public.ai_usage for select using (user_id = auth.uid() or public.is_admin());
create policy "ai_usage: add own" on public.ai_usage for insert with check (user_id = auth.uid());

-- Calls made today (India time) by the signed-in user.
create or replace function public.ai_calls_today() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ai_usage
  where user_id = auth.uid() and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
$$;

-- ---------- Admin: aggregate views only ----------
create or replace function public.admin_user_stats()
returns table (
  id uuid, email text, display_name text, role text, disabled boolean,
  created_at timestamptz, onboarded_at timestamptz,
  last_logged date, days_logged_30d int, ai_calls_today int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.email, p.display_name, p.role, p.disabled, p.created_at, p.onboarded_at,
      (select max(e.day) from public.entries e where e.user_id = p.id),
      (select count(distinct e.day)::int from public.entries e where e.user_id = p.id and e.day > current_date - 30),
      (select count(*)::int from public.ai_usage u where u.user_id = p.id
         and (u.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
    from public.profiles p
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_ai_usage(days int default 14)
returns table (day date, feature text, calls int, failures int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select (u.created_at at time zone 'Asia/Kolkata')::date, u.feature, count(*)::int, count(*) filter (where not u.ok)::int
    from public.ai_usage u
    where u.created_at > now() - make_interval(days => days)
    group by 1, 2 order by 1 desc, 2;
end;
$$;

create or replace function public.admin_set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if new_role not in ('user', 'admin') then raise exception 'Unknown role'; end if;
  if new_role = 'user' and (select count(*) from public.profiles where role = 'admin' and not disabled) <= 1
     and (select role from public.profiles where id = target) = 'admin' then
    raise exception 'Keep at least one admin';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

create or replace function public.admin_set_disabled(target uuid, is_disabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if target = auth.uid() then raise exception 'You cannot disable your own account'; end if;
  update public.profiles set disabled = is_disabled where id = target;
end;
$$;

revoke execute on function public.admin_user_stats() from anon;
revoke execute on function public.admin_ai_usage(int) from anon;
revoke execute on function public.admin_set_role(uuid, text) from anon;
revoke execute on function public.admin_set_disabled(uuid, boolean) from anon;

-- ---------- Meal photos (private bucket, one folder per user) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "meal-photos: read own" on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal-photos: upload own" on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal-photos: delete own" on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Seed content ----------
insert into public.app_settings (key, value) values
  ('ai', '{"photo": true, "text": true, "plan": true, "coach": true, "daily_quota": 25}'::jsonb),
  ('features', '{"signups_open": true}'::jsonb);

insert into public.quotes (text, author, sort) values
  ('Strength is built in the kitchen too.', null, 1),
  ('Show up for your plate the way you show up for class.', null, 2),
  ('One good meal is a rep. Stack them.', null, 3),
  ('You don''t need perfect. You need the next meal.', null, 4),
  ('Fuel first. Then fly.', null, 5),
  ('Ghar ka khana, gym ka results.', null, 6),
  ('Progress is a katori at a time.', null, 7),
  ('Eat like you mean to finish the workout.', null, 8);

insert into public.tour_slides (title, body, image_url, sort) values
  ('Log a meal in seconds', 'Your usuals sit one tap away. Rotis, dal, curd: tap plus and it''s on the board.', '/img/lunch.webp', 1),
  ('Snap your plate', 'Take a photo and Katori suggests what''s on it and how much. You confirm before anything is saved.', '/img/breakfast.webp', 2),
  ('Your plate vs your plan', 'See the food groups you''ve hit today against India''s My Plate guide, and what to add next.', '/img/hero.webp', 3),
  ('Show up. Stack days.', 'Log three meals and the day counts. Build a streak, unlock badges, never get shamed for a slow day.', '/img/dinner.webp', 4);
