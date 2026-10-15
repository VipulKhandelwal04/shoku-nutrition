-- Review fixes. Apply before deploying the matching application; never apply to the shared DB automatically.

-- RLS must enforce account suspension even for an existing JWT or direct PostgREST calls.
create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not disabled);
$$;
revoke execute on function public.is_active_member() from public, anon;
grant execute on function public.is_active_member() to authenticated;

create policy "profiles: active updates" on public.profiles as restrictive for update to authenticated
  using (public.is_active_member()) with check (public.is_active_member());
-- Keep own-profile SELECT available so the app can explain suspension and clear the session.
do $$
declare t text;
begin
  foreach t in array array['foods','entries','days','user_plans','user_badges','workouts','meal_feedback','week_plans','ai_usage','recipes'] loop
    execute format('create policy "active members only" on public.%I as restrictive for all to authenticated using (public.is_active_member()) with check (public.is_active_member())', t);
  end loop;
end;
$$;
create policy "meal photos: active members" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'meal-photos' or public.is_active_member())
  with check (bucket_id <> 'meal-photos' or public.is_active_member());

-- Reject new OAuth users in the creation transaction; no orphan profile can age into admission.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if not coalesce((select (value->>'signups_open')::boolean from public.app_settings where key = 'features'), true)
     and not exists (select 1 from private.admin_emails where lower(email) = lower(new.email)) then
    raise exception 'New sign-ups are paused';
  end if;
  insert into public.profiles (id, email, display_name, avatar_url, role)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    case when exists (select 1 from private.admin_emails where lower(email) = lower(new.email)) then 'admin' else 'user' end);
  return new;
end;
$$;
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.disabled is distinct from old.disabled) and not public.is_admin() then
    raise exception 'Only an admin can change roles or account status';
  end if;
  if old.onboarded_at is null and new.onboarded_at is not null and not public.is_admin()
     and not coalesce((select (value->>'signups_open')::boolean from public.app_settings where key = 'features'), true) then
    raise exception 'New sign-ups are paused';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Reserve quota under a per-member transaction lock BEFORE any paid model call.
-- Only these functions can write usage; callers cannot alter timestamps or delete reservations.
revoke insert, update, delete on public.ai_usage from anon, authenticated;
create or replace function public.reserve_ai_call(p_feature text) returns bigint
language plpgsql security definer set search_path = public as $$
declare settings jsonb; used int; reservation bigint;
begin
  if not public.is_active_member() then raise exception 'Account is not active'; end if;
  if p_feature not in ('photo','text','plan','coach','ask','week') then raise exception 'Unknown AI feature'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select value into settings from public.app_settings where key = 'ai';
  if not coalesce((settings->>'enabled')::boolean, true) or not coalesce((settings->>p_feature)::boolean, true) then
    raise exception 'AI feature is disabled';
  end if;
  select count(*) into used from public.ai_usage where user_id = auth.uid()
    and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
  if used >= coalesce((settings->>'daily_quota')::int, 25) then return null; end if;
  insert into public.ai_usage (user_id, feature, ok) values (auth.uid(), p_feature, false) returning id into reservation;
  return reservation;
end;
$$;
create or replace function public.finish_ai_call(p_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_member() then raise exception 'Account is not active'; end if;
  update public.ai_usage set ok = p_ok where id = p_id and user_id = auth.uid();
end;
$$;
revoke execute on function public.reserve_ai_call(text), public.finish_ai_call(bigint, boolean) from public, anon;
grant execute on function public.reserve_ai_call(text), public.finish_ai_call(bigint, boolean) to authenticated;

-- Private Strava credentials: browser JWTs must not read, replace or advance token/sync state.
revoke execute on function public.connection_tokens(text) from authenticated;
revoke execute on function public.connection_save(text, text, text, text, text, timestamptz, text) from authenticated;
revoke execute on function public.connection_mark_synced(text, timestamptz) from authenticated;
alter table private.connections add column sync_after timestamptz;
alter table private.connections add column sync_before timestamptz;
alter table private.connections add column sync_page int not null default 1;

create function public.connection_tokens_for_user(p_user_id uuid, p_provider text)
returns table (access_token text, refresh_token text, expires_at timestamptz, last_sync_at timestamptz,
               sync_after timestamptz, sync_before timestamptz, sync_page int)
language sql stable security definer set search_path = public, private as $$
  select c.access_token, c.refresh_token, c.expires_at, c.last_sync_at, c.sync_after, c.sync_before, c.sync_page
  from private.connections c join public.profiles p on p.id = c.user_id
  where c.user_id = p_user_id and c.provider = p_provider and not p.disabled;
$$;
create function public.connection_save_for_user(
  p_user_id uuid, p_provider text, p_external_user_id text, p_display_name text,
  p_access_token text, p_refresh_token text, p_expires_at timestamptz, p_scope text
) returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from public.profiles where id = p_user_id and not disabled) then raise exception 'Account is not active'; end if;
  insert into private.connections (user_id, provider, external_user_id, display_name, access_token, refresh_token, expires_at, scope)
  values (p_user_id, p_provider, p_external_user_id, p_display_name, p_access_token, p_refresh_token, p_expires_at, p_scope)
  on conflict (user_id, provider) do update set
    external_user_id = coalesce(nullif(excluded.external_user_id, ''), private.connections.external_user_id),
    display_name = coalesce(excluded.display_name, private.connections.display_name),
    access_token = excluded.access_token, refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at, scope = coalesce(excluded.scope, private.connections.scope);
end;
$$;
create function public.connection_sync_progress(p_user_id uuid, p_after timestamptz, p_before timestamptz, p_page int, p_complete boolean)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from public.profiles where id = p_user_id and not disabled) then raise exception 'Account is not active'; end if;
  if p_page < 1 or p_after >= p_before then raise exception 'Invalid sync window'; end if;
  update private.connections set
    last_sync_at = case when p_complete then p_before else last_sync_at end,
    sync_after = case when p_complete then null else p_after end,
    sync_before = case when p_complete then null else p_before end,
    sync_page = case when p_complete then 1 else p_page end
  where user_id = p_user_id and provider = 'strava';
end;
$$;
revoke all on function public.connection_tokens_for_user(uuid, text),
  public.connection_save_for_user(uuid, text, text, text, text, text, timestamptz, text),
  public.connection_sync_progress(uuid, timestamptz, timestamptz, int, boolean) from public, anon, authenticated;
grant execute on function public.connection_tokens_for_user(uuid, text),
  public.connection_save_for_user(uuid, text, text, text, text, text, timestamptz, text),
  public.connection_sync_progress(uuid, timestamptz, timestamptz, int, boolean) to service_role;

-- Restore is one transaction: an invalid/failed insert cannot leave the member's week deleted.
-- Security invoker preserves the caller's own-row and active-account RLS policies.
create function public.restore_week_plans(p_days jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare flags jsonb; d jsonb;
begin
  if not public.is_active_member() then raise exception 'Account is not active'; end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 7 then raise exception 'Invalid week'; end if;
  if jsonb_array_length(p_days) > 0 then
    select value into flags from public.app_settings where key = 'flags';
    if not coalesce((flags #>> '{week,on}')::boolean, true)
       or not coalesce((flags #>> '{week,ai}')::boolean, true) then raise exception 'Week feature is disabled'; end if;
  end if;
  delete from public.week_plans where user_id = auth.uid();
  for d in select value from jsonb_array_elements(p_days) loop
    insert into public.week_plans (user_id, weekday, plan) values (auth.uid(), (d->>'weekday')::int, d->'plan');
  end loop;
end;
$$;
revoke execute on function public.restore_week_plans(jsonb) from public, anon;
grant execute on function public.restore_week_plans(jsonb) to authenticated;
