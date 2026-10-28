-- Additive, reversible quota state only. No library/profile/notes policies change.
create schema if not exists media_vault_private;
revoke all on schema media_vault_private from public, anon, authenticated;
create table media_vault_private.quick_import_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started timestamptz not null,
  requests integer not null check (requests between 1 and 31)
);
alter table media_vault_private.quick_import_usage enable row level security;
revoke all on media_vault_private.quick_import_usage from public, anon, authenticated;

create function public.consume_quick_import_quota()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_time_value timestamptz := pg_catalog.clock_timestamp();
  used integer;
begin
  if owner_id is null then return false; end if;
  insert into media_vault_private.quick_import_usage as quota(user_id, window_started, requests)
  values(owner_id, current_time_value, 1)
  on conflict(user_id) do update set
    window_started = case when quota.window_started <= current_time_value - interval '10 minutes' then current_time_value else quota.window_started end,
    requests = case when quota.window_started <= current_time_value - interval '10 minutes' then 1 else least(quota.requests + 1, 31) end
  returning requests into used;
  return used <= 30;
end;
$$;
revoke all on function public.consume_quick_import_quota() from public, anon;
grant execute on function public.consume_quick_import_quota() to authenticated;
comment on function public.consume_quick_import_quota() is 'Atomic per-auth.uid() allowance: 30 identification requests per 10 minutes. No caller-supplied owner ID.';
-- Rollback after reverting application code: drop function public.consume_quick_import_quota();
-- drop table media_vault_private.quick_import_usage; (keep the private schema).
