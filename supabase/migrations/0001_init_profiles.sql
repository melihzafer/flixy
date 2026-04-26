-- 0001_init_profiles.sql
-- Initial schema for Flixy: user profiles + region/language preferences.
-- Auth identities live in `auth.users` (managed by Supabase / BetterAuth).
-- Apply via `supabase db push` or your migration runner of choice.

create extension if not exists "uuid-ossp";

-- ==========================================================================
-- profiles: 1:1 with auth.users; created on signup via trigger.
-- ==========================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  region        char(2) not null default 'US' check (region ~ '^[A-Z]{2}$'),
  language      text not null default 'en' check (language in ('en','tr','bg','es','de','fr','pt-BR')),
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_region_idx on public.profiles (region);

-- ==========================================================================
-- updated_at trigger (reusable)
-- ==========================================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ==========================================================================
-- Auto-create a profile row when an auth.user is created.
-- ==========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, is_anonymous)
  values (new.id, coalesce((new.raw_app_meta_data->>'is_anonymous')::boolean, false))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================================
-- RLS: a user can only see / mutate their own profile.
-- ==========================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles: self read"   on public.profiles;
drop policy if exists "profiles: self update" on public.profiles;
drop policy if exists "profiles: self insert" on public.profiles;

create policy "profiles: self read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles: self insert"
  on public.profiles for insert
  with check (auth.uid() = id);
