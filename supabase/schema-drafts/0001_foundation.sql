-- TWISTFUZZ initial schema sketch. Apply only after reviewing in your chosen Supabase project.
-- No client policies granting staff/admin rights are enabled by default.
create extension if not exists pgcrypto;
create type public.twist_role as enum ('customer','staff','admin');
create table if not exists public.profiles (
  firebase_uid text primary key,
  email text not null,
  display_name text,
  role public.twist_role not null default 'customer',
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_path text,
  is_active boolean not null default false,
  price_php numeric(12,2), -- NULL until verified by owner
  created_at timestamptz not null default now()
);
create table if not exists public.flower_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_per_stem_php numeric(12,2), -- NULL means cannot checkout
  enabled boolean not null default true
);
create table if not exists public.custom_designs (
  id uuid primary key default gen_random_uuid(),
  owner_uid text not null references public.profiles(firebase_uid),
  configuration jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_events (
  id bigserial primary key,
  actor_uid text,
  action text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
insert into public.flower_types(name) values ('Tulip'),('Daisy'),('Sunflower'),('Gerbera'),('Rose'),('Lily') on conflict(name) do nothing;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.flower_types enable row level security;
alter table public.custom_designs enable row level security;
alter table public.audit_events enable row level security;
-- Explicit RLS policies and verified Firebase JWT role mapping must be implemented before real user access.
-- Do not add an unrestricted public insert/update on profiles, and never trust role submitted by client.
