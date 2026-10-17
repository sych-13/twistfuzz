-- V0.5 local review candidate, NOT a deployed/generated migration.
-- Apply only to a disposable test database after 0001_foundation.sql.
-- The integration stays disabled until an approved server configures the project.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;
revoke create on schema public from public, anon, authenticated;

create table app_private.auth_configuration (
  singleton boolean primary key default true check (singleton),
  firebase_project_id text check (firebase_project_id is null or firebase_project_id ~ '^[a-z][a-z0-9-]{4,28}[a-z0-9]$'),
  integration_enabled boolean not null default false
);
insert into app_private.auth_configuration(singleton) values (true);
alter table app_private.auth_configuration enable row level security;
alter table app_private.auth_configuration force row level security;
revoke all on app_private.auth_configuration from public, anon, authenticated;
-- Project ID/readiness are public configuration, not credentials. No client writes.
grant select on app_private.auth_configuration to authenticated;
grant select, update on app_private.auth_configuration to service_role;
create policy auth_configuration_read on app_private.auth_configuration
  for select to authenticated using (true);

alter table public.profiles add column is_active boolean not null default true;
alter table public.custom_designs
  add column name text not null default 'Untitled bouquet' check (char_length(btrim(name)) between 1 and 80),
  add column updated_at timestamptz not null default now(),
  add column revision integer not null default 1 check (revision > 0);
create index custom_designs_owner_created_idx on public.custom_designs(owner_uid, created_at desc, id);

-- This assumes the Supabase gateway has cryptographically verified the JWT.
-- Local tests supply the gateway claims context; they do not replace that check.
create function app_private.firebase_uid() returns text
language plpgsql stable security invoker set search_path = '' as $$
declare
  claims jsonb := auth.jwt();
  configured_project text;
  uid text;
  issued numeric;
  expires numeric;
  signed_in numeric;
begin
  select firebase_project_id into configured_project from app_private.auth_configuration
    where singleton and integration_enabled;
  if configured_project is null or jsonb_typeof(claims) is distinct from 'object' then return null; end if;
  uid := claims->>'sub';
  if uid is null or char_length(uid) not between 1 and 128
    or claims->>'iss' is distinct from 'https://securetoken.google.com/' || configured_project
    or claims->>'aud' is distinct from configured_project
    or claims->>'role' is distinct from 'authenticated'
    or claims->'email_verified' is distinct from 'true'::jsonb
    or jsonb_typeof(claims->'firebase') is distinct from 'object'
    or claims->'firebase'->>'sign_in_provider' not in ('password','google.com')
    or claims->'firebase'->>'sign_in_provider' is null
    or claims->'firebase'->'tenant' is not null then return null; end if;
  if jsonb_typeof(claims->'iat') is distinct from 'number'
    or jsonb_typeof(claims->'exp') is distinct from 'number'
    or jsonb_typeof(claims->'auth_time') is distinct from 'number' then return null; end if;
  issued := (claims->>'iat')::numeric;
  expires := (claims->>'exp')::numeric;
  signed_in := (claims->>'auth_time')::numeric;
  if issued <> trunc(issued) or expires <> trunc(expires) or signed_in <> trunc(signed_in)
    or signed_in < 0 or signed_in > issued or issued > extract(epoch from now())
    or expires <= extract(epoch from now()) or expires <= issued then return null; end if;
  return uid;
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end $$;

create function app_private.customer_uid() returns text
language sql stable security invoker set search_path = '' as $$
  select firebase_uid from public.profiles
  where firebase_uid = (select app_private.firebase_uid()) and is_active and role = 'customer';
$$;

-- Database writes cannot bypass bouquet bounds by calling the Data API directly.
-- Keep these options in sync with src/features/studio/design.ts; parity is tested.
create function app_private.valid_bouquet(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare
  flower jsonb;
  palette jsonb := '{"Tulip":["#f3a2bf","#c64765","#fff5e8","#ffd75c","#ab79dc"],"Daisy":["#fff8ef","#f5a5bf","#ffe081","#b489da"],"Sunflower":["#f2ce38","#ef9b24"],"Gerbera":["#f6aac1","#cb3855","#e99332","#ebd44d","#fff7ed","#a78bd6"],"Rose":["#c74b64","#f6a2bd","#fff4ea","#9d72c7","#467cc4"],"Lily":["#fff7ec","#f4a0be","#f7db75","#ee953e"]}'::jsonb;
  quantity numeric;
  stems numeric := 0;
begin
  if value is null or jsonb_typeof(value) is distinct from 'object' or octet_length(value::text) > 16000 then return false; end if;
  if (select count(*) from jsonb_object_keys(value)) <> 4
    or not value ?& array['flowers','wrapper','ribbon','messageCard']
    or jsonb_typeof(value->'flowers') is distinct from 'array'
    or jsonb_typeof(value->'messageCard') is distinct from 'boolean'
    or jsonb_typeof(value->'wrapper') is distinct from 'string'
    or jsonb_typeof(value->'ribbon') is distinct from 'string'
    or value->>'wrapper' not in ('Kraft Brown','Pastel Pink','White','Lavender','Elegant Black')
    or value->>'ribbon' not in ('Standard Satin','Personalized Printed','No Ribbon') then return false; end if;
  if jsonb_array_length(value->'flowers') > 30 then return false; end if;
  for flower in select jsonb_array_elements(value->'flowers') loop
    if jsonb_typeof(flower) is distinct from 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(flower)) <> 3
      or not flower ?& array['kind','color','count']
      or jsonb_typeof(flower->'kind') is distinct from 'string'
      or jsonb_typeof(flower->'color') is distinct from 'string'
      or jsonb_typeof(flower->'count') is distinct from 'number'
      or not palette ? (flower->>'kind') then return false; end if;
    if not (palette->(flower->>'kind')) ? (flower->>'color') then return false; end if;
    quantity := (flower->>'count')::numeric;
    if quantity < 1 or quantity > 30 or quantity <> trunc(quantity) then return false; end if;
    stems := stems + quantity;
    if stems > 30 then return false; end if;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;

alter table public.custom_designs add constraint custom_designs_valid_configuration
  check (app_private.valid_bouquet(configuration));

create function app_private.touch_design() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.owner_uid is distinct from old.owner_uid or new.created_at is distinct from old.created_at then
    raise exception 'Saved design identity is immutable' using errcode = '42501';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger custom_designs_update_metadata before update on public.custom_designs
  for each row execute function app_private.touch_design();

revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.firebase_uid(), app_private.customer_uid(), app_private.valid_bouquet(jsonb), app_private.touch_design()
  to authenticated, service_role;

-- Explicit grants are independent of RLS and the hosted Data API exposure setting.
revoke all on public.profiles, public.custom_designs, public.products, public.flower_types, public.audit_events
  from public, anon, authenticated;
revoke all on sequence public.audit_events_id_seq from public, anon, authenticated;
grant select on public.profiles, public.custom_designs to authenticated;
grant insert(owner_uid, name, configuration), update(name, configuration), delete on public.custom_designs to authenticated;
grant select, insert, update, delete on public.profiles, public.custom_designs to service_role;
grant insert on public.audit_events to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;

alter table public.profiles force row level security;
alter table public.custom_designs force row level security;
alter table public.products force row level security;
alter table public.flower_types force row level security;
alter table public.audit_events force row level security;

create policy profile_own_read on public.profiles for select to authenticated
  using (is_active and firebase_uid = (select app_private.firebase_uid()));
create policy profile_identity_guard on public.profiles as restrictive for select to authenticated
  using (is_active and firebase_uid = (select app_private.firebase_uid()));
create policy profile_no_client_create on public.profiles as restrictive for insert to authenticated with check (false);
create policy profile_no_client_update on public.profiles as restrictive for update to authenticated using (false) with check (false);
create policy profile_no_client_delete on public.profiles as restrictive for delete to authenticated using (false);

create policy design_own_access on public.custom_designs for all to authenticated
  using (owner_uid = (select app_private.customer_uid()))
  with check (owner_uid = (select app_private.customer_uid()));
-- Restrictive ownership remains enforced if a later permissive policy is too broad.
create policy design_owner_guard on public.custom_designs as restrictive for all to authenticated
  using (owner_uid = (select app_private.customer_uid()))
  with check (owner_uid = (select app_private.customer_uid()));

-- Internal RPC: only a verified server endpoint may supply a Firebase identity.
-- No role argument, no conflict update, no reactivation and an atomic creation audit.
create function public.resolve_business_role(p_uid text, p_project_id text)
returns table(role public.twist_role)
language sql stable security invoker set search_path = '' as $$
  select p.role from public.profiles p
  where p.firebase_uid = p_uid and p.is_active and exists (
    select 1 from app_private.auth_configuration c where c.singleton and c.integration_enabled
      and c.firebase_project_id = p_project_id
  );
$$;
revoke all on function public.resolve_business_role(text,text) from public, anon, authenticated;
grant execute on function public.resolve_business_role(text,text) to service_role;

create function public.provision_customer_profile(p_uid text, p_email text, p_project_id text)
returns table(firebase_uid text, role public.twist_role, is_active boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  created_count integer;
  profile public.profiles%rowtype;
begin
  if not exists (select 1 from app_private.auth_configuration where singleton and integration_enabled
    and firebase_project_id = p_project_id) then
    raise exception 'Customer provisioning project is unavailable' using errcode = '42501';
  end if;
  if p_uid is null or char_length(p_uid) not between 1 and 128 or p_email is null
    or char_length(p_email) not between 3 and 320 or position('@' in p_email) < 2 then
    raise exception 'Invalid verified account identity' using errcode = '22023';
  end if;
  insert into public.profiles(firebase_uid,email,role,is_active)
    values(p_uid,p_email,'customer',true) on conflict on constraint profiles_pkey do nothing;
  get diagnostics created_count = row_count;
  select p.* into profile from public.profiles p where p.firebase_uid = p_uid for update;
  if profile.role is distinct from 'customer' or not profile.is_active then
    raise exception 'Account cannot be provisioned as Customer' using errcode = '42501';
  end if;
  if created_count = 1 then
    insert into public.audit_events(actor_uid,action,target_id,details)
      values(p_uid,'profile.customer_provisioned',p_uid,jsonb_build_object('role','customer'));
  end if;
  return query select profile.firebase_uid, profile.role, profile.is_active;
end $$;
revoke all on function public.provision_customer_profile(text,text,text) from public, anon, authenticated;
grant execute on function public.provision_customer_profile(text,text,text) to service_role;

commit;
