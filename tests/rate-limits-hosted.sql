-- Development verification only. Every fixture/config change is rolled back.
-- Refuses to run against an enabled or populated limiter. No test JWT is used.
begin;
do $$
begin
  if exists(select 1 from app_private.auth_configuration where integration_enabled)
    or exists(select 1 from app_private.request_allowances) then
    raise exception 'Hosted limiter verification requires closed, empty development state';
  end if;
  if has_function_privilege('anon','public.consume_request_allowance(text,text,text)','execute')
    or has_function_privilege('authenticated','public.consume_request_allowance(text,text,text)','execute')
    or has_table_privilege('authenticated','app_private.request_allowances','select') then
    raise exception 'Browser privilege boundary failed';
  end if;
  begin
    perform public.consume_request_allowance('twistfuzz-dev-sych13','global',null);
    raise exception 'Closed gate was bypassed';
  exception when insufficient_privilege then null; end;
end $$;
update app_private.auth_configuration set firebase_project_id='twistfuzz-dev-sych13', integration_enabled=true where singleton;
set local role service_role;
do $$
declare
  decision record;
  old_expiry timestamptz;
  current_used integer;
  global_allowed integer := 0;
  identity_allowed integer := 0;
begin
  for i in 1..601 loop
    select * into decision from public.consume_request_allowance('twistfuzz-dev-sych13','global',null);
    if decision.allowed then global_allowed := global_allowed + 1;
    elsif decision.retry_after_seconds not between 1 and 60 then raise exception 'Invalid global retry'; end if;
  end loop;
  if global_allowed <> 600 then raise exception 'Global capacity failed'; end if;
  for i in 1..61 loop
    select * into decision from public.consume_request_allowance('twistfuzz-dev-sych13','identity','qa-rate-a');
    if decision.allowed then identity_allowed := identity_allowed + 1;
    elsif decision.retry_after_seconds not between 1 and 60 then raise exception 'Invalid identity retry'; end if;
  end loop;
  if identity_allowed <> 60 then raise exception 'Identity capacity failed'; end if;
  select window_expires_at into old_expiry from app_private.request_allowances where scope='identity';
  perform public.consume_request_allowance('twistfuzz-dev-sych13','identity','qa-rate-a');
  if not exists(select 1 from app_private.request_allowances where scope='identity' and used=60 and window_expires_at=old_expiry) then
    raise exception 'Denied requests modified the window';
  end if;
  select * into decision from public.consume_request_allowance('twistfuzz-dev-sych13','identity','qa-rate-b');
  if not decision.allowed then raise exception 'Identity isolation failed'; end if;
  if exists(select 1 from app_private.request_allowances where scope='identity' and subject_key !~ '^[0-9a-f]{64}$') then
    raise exception 'Raw identity retained';
  end if;
  update app_private.request_allowances set window_expires_at=clock_timestamp()-interval '1 second' where scope='global';
  select * into decision from public.consume_request_allowance('twistfuzz-dev-sych13','global',null);
  select used into current_used from app_private.request_allowances where scope='global';
  if not decision.allowed or current_used <> 1 then raise exception 'Expired capacity failed to reset'; end if;
  begin
    perform public.consume_request_allowance('wrong-project','global',null);
    raise exception 'Wrong project accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.consume_request_allowance('twistfuzz-dev-sych13','global','caller-key');
    raise exception 'Caller-selected global key accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
select 'PASS' as outcome, 'closed gate, browser grants, global 600, identity 60, fixed expiry, identity isolation, hashed keys, reset, project pin, scope validation' as checks;
rollback;
