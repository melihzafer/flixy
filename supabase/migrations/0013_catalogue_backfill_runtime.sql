-- 0013_catalogue_backfill_runtime.sql
-- Resumable TMDB global catalogue backfill state and scheduled small-step jobs.

create table if not exists public.catalogue_backfill_jobs (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('movie','tv')),
  source             text not null default 'tmdb_export' check (source in ('tmdb_export','tmdb_changes')),
  snapshot_date      date not null,
  status             text not null default 'pending' check (status in ('pending','running','paused','completed','failed')),
  regions            char(2)[] not null default '{}'::char(2)[],
  language           text not null default 'en-US',
  include_adult      boolean not null default true,
  include_unreleased boolean not null default true,
  batch_size         integer not null default 250 check (batch_size between 1 and 2000),
  total_candidates   integer not null default 0,
  processed_count    integer not null default 0,
  title_count        integer not null default 0,
  video_count        integer not null default 0,
  availability_count integer not null default 0,
  error_count        integer not null default 0,
  skipped_count      integer not null default 0,
  last_error         text,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists catalogue_backfill_jobs_set_updated_at on public.catalogue_backfill_jobs;
create trigger catalogue_backfill_jobs_set_updated_at
  before update on public.catalogue_backfill_jobs
  for each row execute function public.tg_set_updated_at();

create table if not exists public.catalogue_backfill_cursors (
  job_id                  uuid primary key references public.catalogue_backfill_jobs(id) on delete cascade,
  next_offset             integer not null default 0 check (next_offset >= 0),
  batch_size              integer not null default 250 check (batch_size between 1 and 2000),
  last_processed_tmdb_id  integer,
  last_step_at            timestamptz,
  consecutive_failures    integer not null default 0,
  updated_at              timestamptz not null default now()
);

drop trigger if exists catalogue_backfill_cursors_set_updated_at on public.catalogue_backfill_cursors;
create trigger catalogue_backfill_cursors_set_updated_at
  before update on public.catalogue_backfill_cursors
  for each row execute function public.tg_set_updated_at();

create table if not exists public.catalogue_backfill_batches (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.catalogue_backfill_jobs(id) on delete cascade,
  batch_number   integer not null,
  offset_start   integer not null check (offset_start >= 0),
  offset_end     integer not null check (offset_end >= offset_start),
  candidate_ids  integer[] not null default '{}'::integer[],
  succeeded_ids  integer[] not null default '{}'::integer[],
  failed_ids     integer[] not null default '{}'::integer[],
  duration_ms    integer,
  api_calls      integer not null default 0,
  status         text not null check (status in ('running','completed','failed')),
  error          text,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists catalogue_backfill_jobs_status_idx
  on public.catalogue_backfill_jobs (status, kind, created_at);

create index if not exists catalogue_backfill_batches_job_idx
  on public.catalogue_backfill_batches (job_id, batch_number);

alter table public.titles
  add column if not exists last_backfill_batch_id uuid references public.catalogue_backfill_batches(id),
  add column if not exists last_ingested_at timestamptz not null default now(),
  add column if not exists ingestion_source text check (ingestion_source in ('seed','tmdb','backfill','changes','trending'));

alter table public.catalogue_backfill_jobs enable row level security;
alter table public.catalogue_backfill_cursors enable row level security;
alter table public.catalogue_backfill_batches enable row level security;

do $$
declare
  job_id bigint;
begin
  for job_id in
    select jobid
    from cron.job
    where jobname in ('catalogue_backfill_movie_step', 'catalogue_backfill_tv_step')
  loop
    perform cron.unschedule(job_id);
  end loop;
end$$;

select cron.schedule(
  'catalogue_backfill_movie_step',
  '*/5 * * * *',
  $$select public.catalogue_ingest_invoke(jsonb_build_object('mode','backfill_step','kind','movie','dryRun',false,'limit',250));$$
);

select cron.schedule(
  'catalogue_backfill_tv_step',
  '2-59/5 * * * *',
  $$select public.catalogue_ingest_invoke(jsonb_build_object('mode','backfill_step','kind','tv','dryRun',false,'limit',250));$$
);
