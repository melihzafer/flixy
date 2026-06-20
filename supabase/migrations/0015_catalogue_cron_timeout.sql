-- 0015_catalogue_cron_timeout.sql
-- Backfill steps can legitimately run longer than pg_net's old 30s timeout.
-- Keep the HTTP request alive long enough for the Edge Function to checkpoint
-- the cursor and batch metrics before pg_cron starts the next step.

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
    timeout_milliseconds := 120000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.catalogue_ingest_invoke(jsonb) from public;
grant execute on function public.catalogue_ingest_invoke(jsonb) to postgres, service_role;
