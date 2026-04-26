-- 0002_user_preferences_lookups.sql
-- Adds onboarding state + supporting lookup tables (streaming services per
-- region, content genres). RLS keeps user_preferences self-only; lookup
-- tables are public-read.
--
-- Per FSD § 3.2: services are region-scoped; the user must select ≥1 service
-- and 3-12 genres before the cold-start swipe round is unlocked.

-- ==========================================================================
-- streaming_services: catalogue of providers, with availability per region.
-- ==========================================================================
create table if not exists public.streaming_services (
  id           text primary key,            -- short slug, e.g. 'netflix'
  name         text not null,
  logo_url     text,
  regions      char(2)[] not null default '{}'::char(2)[],
  display_rank int not null default 100
);

create index if not exists streaming_services_regions_idx
  on public.streaming_services using gin (regions);

alter table public.streaming_services enable row level security;

drop policy if exists "streaming_services: public read" on public.streaming_services;
create policy "streaming_services: public read"
  on public.streaming_services for select using (true);

-- ==========================================================================
-- genres: short, language-agnostic identifiers; UI provides translations.
-- ==========================================================================
create table if not exists public.genres (
  id           text primary key,            -- e.g. 'drama', 'sci_fi'
  display_rank int not null default 100
);

alter table public.genres enable row level security;
drop policy if exists "genres: public read" on public.genres;
create policy "genres: public read" on public.genres for select using (true);

-- ==========================================================================
-- user_preferences: 1:1 with profiles; tracks onboarding state.
-- ==========================================================================
create table if not exists public.user_preferences (
  user_id                  uuid primary key references public.profiles (id) on delete cascade,
  selected_services        text[] not null default '{}'::text[],
  selected_genres          text[] not null default '{}'::text[],
  notifications_enabled    boolean not null default false,
  onboarding_completed_at  timestamptz,
  cold_start_completed_at  timestamptz,
  updated_at               timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.tg_set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences: self read"   on public.user_preferences;
drop policy if exists "user_preferences: self upsert" on public.user_preferences;
drop policy if exists "user_preferences: self update" on public.user_preferences;

create policy "user_preferences: self read"
  on public.user_preferences for select using (auth.uid() = user_id);
create policy "user_preferences: self upsert"
  on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "user_preferences: self update"
  on public.user_preferences for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create empty preferences row alongside the profile.
create or replace function public.handle_new_user_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_profile_created_create_prefs on public.profiles;
create trigger on_profile_created_create_prefs
  after insert on public.profiles
  for each row execute function public.handle_new_user_preferences();

-- ==========================================================================
-- Seed: launch genres + a starter service catalogue per launch region.
-- Idempotent via on conflict.
-- ==========================================================================
insert into public.genres (id, display_rank) values
  ('action', 10), ('adventure', 20), ('animation', 30), ('comedy', 40),
  ('crime', 50), ('documentary', 60), ('drama', 70), ('family', 80),
  ('fantasy', 90), ('horror', 100), ('mystery', 110), ('romance', 120),
  ('sci_fi', 130), ('thriller', 140), ('war', 150), ('western', 160)
on conflict (id) do nothing;

insert into public.streaming_services (id, name, regions, display_rank) values
  ('netflix',     'Netflix',          '{US,TR,BG,ES,DE,FR,BR}', 10),
  ('prime_video', 'Prime Video',      '{US,TR,BG,ES,DE,FR,BR}', 20),
  ('disney_plus', 'Disney+',          '{US,TR,BG,ES,DE,FR,BR}', 30),
  ('hbo_max',     'Max',              '{US,ES,DE,FR,BR}',       40),
  ('apple_tv',    'Apple TV+',        '{US,TR,BG,ES,DE,FR,BR}', 50),
  ('hulu',        'Hulu',             '{US}',                    60),
  ('paramount',   'Paramount+',       '{US,DE,FR,BR}',           70),
  ('peacock',     'Peacock',          '{US}',                    80),
  ('blutv',       'BluTV',            '{TR}',                    90),
  ('exxen',       'Exxen',            '{TR}',                   100),
  ('mubi',        'MUBI',             '{US,TR,BG,ES,DE,FR,BR}', 110),
  ('movistar',    'Movistar Plus+',   '{ES}',                   120),
  ('canal_plus',  'Canal+',           '{FR}',                   130),
  ('globoplay',   'Globoplay',        '{BR}',                   140)
on conflict (id) do update
  set name = excluded.name,
      regions = excluded.regions,
      display_rank = excluded.display_rank;
