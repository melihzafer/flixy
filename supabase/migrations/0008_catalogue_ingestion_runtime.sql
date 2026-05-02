-- 0008_catalogue_ingestion_runtime.sql
-- Runtime support for server-side TMDB catalogue ingestion.

alter table public.titles
  add column if not exists external_ids jsonb not null default '{}'::jsonb,
  add column if not exists tmdb_vote_average numeric(3,1) check (tmdb_vote_average is null or tmdb_vote_average between 0 and 10),
  add column if not exists metadata_source text not null default 'seed' check (metadata_source in ('seed','tmdb','admin'));

create table if not exists public.tmdb_ingest_cache (
  cache_key  text primary key,
  response   jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists tmdb_ingest_cache_expires_idx
  on public.tmdb_ingest_cache (expires_at);

alter table public.tmdb_ingest_cache enable row level security;

create table if not exists public.catalogue_ingest_runs (
  id               uuid primary key default gen_random_uuid(),
  mode             text not null check (mode in ('dry_run','write')),
  regions          char(2)[] not null default '{}'::char(2)[],
  content_types    text[] not null default '{}'::text[],
  requested_limit  integer not null default 0,
  candidate_count  integer not null default 0,
  title_count      integer not null default 0,
  video_count      integer not null default 0,
  availability_count integer not null default 0,
  error_message    text,
  created_at       timestamptz not null default now()
);

alter table public.catalogue_ingest_runs enable row level security;
