-- 0009_catalogue_ingest_cron.sql
-- Schedule the catalogue-ingest edge function via pg_cron + pg_net.
--
-- Two cadences:
--   * trending — hourly, trending/day per region (cheap, fresh signal)
--   * full     — daily 03:00 UTC, popular + now_playing + on_the_air
--
-- Prereqs (set via Supabase Dashboard → Project Settings → Database → Vault
-- or as edge-function env vars):
--   * vault secret 'catalogue_ingest_cron_secret'  → matches CRON_SECRET on the edge function
--   * vault secret 'catalogue_ingest_function_url' → e.g. https://<ref>.functions.supabase.co/catalogue-ingest
--
-- The migration is idempotent: dropping then recreating the schedules is
-- safe because pg_cron rows are keyed by jobname.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: read a secret from Supabase Vault. Falls back to NULL if absent
-- so the migration applies cleanly even before secrets are configured.
create or replace function public.catalogue_ingest_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;
$$;

revoke all on function public.catalogue_ingest_secret(text) from public;
grant execute on function public.catalogue_ingest_secret(text) to postgres, service_role;

-- Helper: post to the edge function with the bearer auth header.
create or replace function public.catalogue_ingest_invoke(payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  fn_url   text := public.catalogue_ingest_secret('catalogue_ingest_function_url');
  cron_key text := public.catalogue_ingest_secret('catalogue_ingest_cron_secret');
  request_id bigint;
begin
  if fn_url is null or cron_key is null then
    raise notice 'catalogue_ingest_invoke skipped: secrets not configured';
    return null;
  end if;

  select net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || cron_key
    ),
    body := payload,
    timeout_milliseconds := 30000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.catalogue_ingest_invoke(jsonb) from public;
grant execute on function public.catalogue_ingest_invoke(jsonb) to postgres, service_role;

-- Unschedule prior versions so reapplying this migration is safe.
do $$
declare
  job_id bigint;
begin
  for job_id in
    select jobid from cron.job where jobname in ('catalogue_ingest_trending', 'catalogue_ingest_full')
  loop
    perform cron.unschedule(job_id);
  end loop;
end$$;

-- Hourly trending pass (dry-run for first deployment; flip to write later).
select cron.schedule(
  'catalogue_ingest_trending',
  '7 * * * *',
  $$select public.catalogue_ingest_invoke(jsonb_build_object('mode','trending','dryRun',true));$$
);

-- Daily full pass at 03:00 UTC (dry-run for first deployment).
select cron.schedule(
  'catalogue_ingest_full',
  '0 3 * * *',
  $$select public.catalogue_ingest_invoke(jsonb_build_object('mode','full','dryRun',true));$$
);
