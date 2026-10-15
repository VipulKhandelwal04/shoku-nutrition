-- Postgres grants EXECUTE to PUBLIC by default, so the earlier `revoke ... from anon` did not take effect.
-- Every admin_* function already checks is_admin() itself; this removes them from the signed-out API surface.

revoke execute on function public.admin_user_stats() from public, anon;
revoke execute on function public.admin_ai_usage(int) from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
revoke execute on function public.admin_set_disabled(uuid, boolean) from public, anon;
grant execute on function public.admin_user_stats() to authenticated;
grant execute on function public.admin_ai_usage(int) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_disabled(uuid, boolean) to authenticated;

revoke execute on function public.ai_calls_today() from public, anon;
grant execute on function public.ai_calls_today() to authenticated;

-- Trigger functions are never called over the API (EXECUTE is not checked when a trigger fires).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;

-- is_admin() stays executable by anon and authenticated: RLS policies on public content call it.
