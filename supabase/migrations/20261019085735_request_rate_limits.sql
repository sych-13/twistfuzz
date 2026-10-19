-- Shared counters for the three verified API endpoints. This does not open
-- authentication, change business roles or grant any browser access.
create table app_private.request_allowances (
  scope text not null check (scope in ('global', 'identity')),
  subject_key text not null,
  window_expires_at timestamptz not null,
  used integer not null check (used >= 1 and used <= case when scope = 'global' then 600 else 60 end),
  primary key (scope, subject_key),
  check ((scope = 'global' and subject_key = 'global') or
    (scope = 'identity' and subject_key ~ '^[0-9a-f]{64}$'))
);
create index request_allowances_expiry_idx on app_private.request_allowances(window_expires_at);
alter table app_private.request_allowances enable row level security;
alter table app_private.request_allowances force row level security;
revoke all on app_private.request_allowances from public, anon, authenticated;
grant select, insert, update, delete on app_private.request_allowances to service_role;

create function public.consume_request_allowance(p_project_id text, p_scope text, p_uid text default null)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security invoker set search_path = '' set lock_timeout = '1s' as $$
declare
  current_time_value timestamptz := clock_timestamp();
  subject text;
  capacity integer;
  accepted boolean;
  expires timestamptz;
begin
  if not exists (select 1 from app_private.auth_configuration where singleton and integration_enabled
    and firebase_project_id = p_project_id) then
    raise exception 'Request protection project is unavailable' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('global', 'identity') or
    (p_scope = 'global' and p_uid is not null) or
    (p_scope = 'identity' and (p_uid is null or char_length(p_uid) not between 1 and 128)) then
    raise exception 'Invalid request protection scope' using errcode = '22023';
  end if;
  capacity := case when p_scope = 'global' then 600 else 60 end;
  subject := case when p_scope = 'global' then 'global'
    else encode(sha256(convert_to(p_project_id || ':' || p_uid, 'UTF8')), 'hex') end;

  -- Bounded, opportunistic cleanup. No scheduled job or paid service is added.
  -- Idle projects can retain expired hashes until the next active request.
  with expired as (
    select a.scope, a.subject_key from app_private.request_allowances a
    where a.window_expires_at < current_time_value - interval '24 hours'
    order by a.window_expires_at limit 100 for update skip locked
  ) delete from app_private.request_allowances a using expired e
    where a.scope = e.scope and a.subject_key = e.subject_key;

  -- ON CONFLICT locks the shared row before checking capacity. Rejected calls
  -- neither increment the count nor extend its expiry. The clock is server-only.
  insert into app_private.request_allowances as a(scope, subject_key, window_expires_at, used)
    values(p_scope, subject, current_time_value + interval '60 seconds', 1)
  on conflict (scope, subject_key) do update set
    used = case when a.window_expires_at <= current_time_value then 1 else a.used + 1 end,
    window_expires_at = case when a.window_expires_at <= current_time_value
      then current_time_value + interval '60 seconds' else a.window_expires_at end
    where a.window_expires_at <= current_time_value or a.used < capacity
  returning true into accepted;

  if accepted is true then
    return query select true, 0;
  else
    select a.window_expires_at into expires from app_private.request_allowances a
      where a.scope = p_scope and a.subject_key = subject;
    if expires is null then raise exception 'Request protection unavailable'; end if;
    return query select false, greatest(1, least(60, ceil(extract(epoch from expires - clock_timestamp()))::integer));
  end if;
end $$;
revoke all on function public.consume_request_allowance(text,text,text) from public, anon, authenticated;
grant execute on function public.consume_request_allowance(text,text,text) to service_role;
