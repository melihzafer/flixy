-- 0012_enrichment_cron.sql
-- Schedule the omdb-enrich and trakt-sync edge functions via pg_cron + pg_net.
-- Reuses the helper functions defined in 0009_catalogue_ingest_cron.sql but
-- needs separate Vault entries for each function URL. Both helpers below
-- skip silently if the corresponding vault secret is unset.

create or replace function public.omdb_enrich_invoke(payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  fn_url   text := public.catalogue_ingest_secret('omdb_enrich_function_url');
  cron_key text := public.catalogue_ingest_secret('catalogue_ingest_cron_secret');
  request_id bigint;
begin
  if fn_url is null or cron_key is null then
    raise notice 'omdb_enrich_invoke skipped: secrets not configured';
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

revoke all on function public.omdb_enrich_invoke(jsonb) from public;
grant execute on function public.omdb_enrich_invoke(jsonb) to postgres, service_role;

create or replace function public.trakt_sync_invoke(payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  fn_url   text := public.catalogue_ingest_secret('trakt_sync_function_url');
  cron_key text := public.catalogue_ingest_secret('catalogue_ingest_cron_secret');
  request_id bigint;
begin
  if fn_url is null or cron_key is null then
    raise notice 'trakt_sync_invoke skipped: secrets not configured';
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

revoke all on function public.trakt_sync_invoke(jsonb) from public;
grant execute on function public.trakt_sync_invoke(jsonb) to postgres, service_role;

do $$
declare
  job_id bigint;
begin
  for job_id in
    select jobid from cron.job
    where jobname in ('omdb_enrich_daily', 'trakt_sync_hourly')
  loop
    perform cron.unschedule(job_id);
  end loop;
end$$;

-- OMDb enrichment runs daily 04:30 UTC, after the full TMDB ingest at 03:00.
-- Default batch size of 100 keeps us at ~3000 OMDb requests/month — well
-- under the 1000/day free-tier cap.
select cron.schedule(
  'omdb_enrich_daily',
  '30 4 * * *',
  $$select public.omdb_enrich_invoke(jsonb_build_object('batchSize',100,'dryRun',false));$$
);

-- Trakt sync runs hourly at minute 13 (offset from catalogue trending at :07).
select cron.schedule(
  'trakt_sync_hourly',
  '13 * * * *',
  $$select public.trakt_sync_invoke(jsonb_build_object('dryRun',false));$$
);
