-- Workouts (calories burned) and fitness-app connections (Strava first).

create type public.workout_source as enum ('manual', 'strava');

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (char_length(kind) between 1 and 40),
  label text not null check (char_length(label) between 1 and 80),
  minutes int not null check (minutes between 1 and 600),
  kcal int not null check (kcal between 0 and 5000),
  -- estimate = Shoku's MET estimate; device = a number from a watch or app (Strava detail, or typed in by the user)
  kcal_source text not null default 'estimate' check (kcal_source in ('estimate', 'device')),
  source public.workout_source not null default 'manual',
  external_id text,
  -- Imported workouts are hidden rather than deleted, so the next sync doesn't bring them back.
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index workouts_user_day on public.workouts (user_id, day);
alter table public.workouts enable row level security;
create policy "workouts: own rows" on public.workouts for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Tokens live in the private schema (not exposed by the API). Only the narrow functions below touch them,
-- and each one only ever sees the caller's own row.
create table private.connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava')),
  external_user_id text not null,
  display_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- Safe status for the UI: no tokens.
create or replace function public.my_connections()
returns table (provider text, display_name text, last_sync_at timestamptz, connected_at timestamptz)
language sql stable security definer set search_path = private, public as $$
  select c.provider, c.display_name, c.last_sync_at, c.created_at from private.connections c where c.user_id = auth.uid();
$$;

-- Server routes only (they run as the signed-in user): read, save, mark synced, remove.
create or replace function public.connection_tokens(p_provider text)
returns table (access_token text, refresh_token text, expires_at timestamptz, last_sync_at timestamptz)
language sql stable security definer set search_path = private, public as $$
  select c.access_token, c.refresh_token, c.expires_at, c.last_sync_at
  from private.connections c where c.user_id = auth.uid() and c.provider = p_provider;
$$;

create or replace function public.connection_save(
  p_provider text, p_external_user_id text, p_display_name text,
  p_access_token text, p_refresh_token text, p_expires_at timestamptz, p_scope text
) returns void language plpgsql security definer set search_path = private, public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into private.connections (user_id, provider, external_user_id, display_name, access_token, refresh_token, expires_at, scope)
  values (auth.uid(), p_provider, p_external_user_id, p_display_name, p_access_token, p_refresh_token, p_expires_at, p_scope)
  on conflict (user_id, provider) do update set
    external_user_id = coalesce(nullif(excluded.external_user_id, ''), private.connections.external_user_id),
    display_name = coalesce(excluded.display_name, private.connections.display_name),
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at,
    scope = coalesce(excluded.scope, private.connections.scope);
end;
$$;

create or replace function public.connection_mark_synced(p_provider text, p_at timestamptz)
returns void language sql security definer set search_path = private, public as $$
  update private.connections set last_sync_at = p_at where user_id = auth.uid() and provider = p_provider;
$$;

create or replace function public.connection_remove(p_provider text)
returns void language plpgsql security definer set search_path = private, public as $$
begin
  delete from private.connections where user_id = auth.uid() and provider = p_provider;
  -- Imported data goes with the connection.
  delete from public.workouts where user_id = auth.uid() and source::text = p_provider;
end;
$$;

revoke execute on function public.my_connections() from public, anon;
revoke execute on function public.connection_tokens(text) from public, anon;
revoke execute on function public.connection_save(text, text, text, text, text, timestamptz, text) from public, anon;
revoke execute on function public.connection_mark_synced(text, timestamptz) from public, anon;
revoke execute on function public.connection_remove(text) from public, anon;
grant execute on function public.my_connections() to authenticated;
grant execute on function public.connection_tokens(text) to authenticated;
grant execute on function public.connection_save(text, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.connection_mark_synced(text, timestamptz) to authenticated;
grant execute on function public.connection_remove(text) to authenticated;
