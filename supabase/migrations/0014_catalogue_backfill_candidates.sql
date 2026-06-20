-- 0014_catalogue_backfill_candidates.sql
-- Persist TMDB export candidates once per backfill job so scheduled steps do
-- not re-download and parse the full export every invocation.

create table if not exists public.catalogue_backfill_candidates (
  job_id       uuid not null references public.catalogue_backfill_jobs(id) on delete cascade,
  offset_index integer not null check (offset_index >= 0),
  tmdb_id      integer not null check (tmdb_id > 0),
  popularity   numeric not null default 0,
  adult        boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (job_id, offset_index),
  unique (job_id, tmdb_id)
);

create index if not exists catalogue_backfill_candidates_job_tmdb_idx
  on public.catalogue_backfill_candidates (job_id, tmdb_id);

alter table public.catalogue_backfill_candidates enable row level security;
