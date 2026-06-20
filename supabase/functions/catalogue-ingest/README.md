# Catalogue ingestion edge functions

Three Supabase Edge Functions run on a `pg_cron` schedule against staging
Supabase:

| Function          | Purpose                                                                          | Schedule (UTC)        |
| ----------------- | -------------------------------------------------------------------------------- | --------------------- |
| `catalogue-ingest`| Pulls TMDB candidates + details, writes titles/videos/availability               | hourly :07 (trending), daily 03:00 (full), every 5 min (backfill steps) |
| `omdb-enrich`     | Adds IMDb rating/votes/awards to titles whose external_ids include `imdb_id`     | daily 04:30           |
| `trakt-sync`      | Pulls Trakt trending watcher counts; annotates titles by tmdb_id                 | hourly :13            |

All three import the shared TS sources at `supabase/functions/_shared/catalogue/`,
which are mirrored from `packages/catalogue-ingest/src/`. The Node CLI in
that package stays as the canonical implementation for ad-hoc backfills.

## Required env vars (set in Supabase Dashboard → Edge Functions → Secrets)

| Name                        | Used by                            | Notes                                                                 |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `SUPABASE_URL`              | all (auto-injected)                | Provided by the platform.                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | all (auto-injected)                | Provided by the platform; used for catalogue writes.                  |
| `CRON_SECRET`               | all                                | Random 32+ byte token shared with `pg_cron` callers via Vault.        |
| `TMDB_BEARER_TOKEN`         | catalogue-ingest                   | TMDB v4 read-access token.                                            |
| `OMDB_API_KEY`              | omdb-enrich                        | OMDb free tier key (1000 req/day).                                    |
| `TRAKT_CLIENT_ID`           | trakt-sync                         | Trakt API client id (no OAuth needed for trending endpoints).         |

## Required Vault secrets (Supabase Dashboard → Project Settings → Vault)

These are read by the cron migration `0009_catalogue_ingest_cron.sql` so
`pg_net` knows where to post and which token to send.

| Vault secret name                  | Value                                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| `catalogue_ingest_function_url`    | `https://<project-ref>.functions.supabase.co/catalogue-ingest`     |
| `omdb_enrich_function_url`         | `https://<project-ref>.functions.supabase.co/omdb-enrich`          |
| `trakt_sync_function_url`          | `https://<project-ref>.functions.supabase.co/trakt-sync`           |
| `catalogue_ingest_cron_secret`     | Same value as the `CRON_SECRET` edge function env var (shared).    |

If `catalogue_ingest_function_url` or `catalogue_ingest_cron_secret` is missing,
`public.catalogue_ingest_invoke(...)` returns `NULL` and pg_cron effectively
skips ingestion. Verify it returns a non-null request id after any environment
or database restore.

## Deploy

You need a personal access token with project scope:
<https://supabase.com/dashboard/account/tokens>

```sh
export SUPABASE_ACCESS_TOKEN=sbp_...
export SUPABASE_DB_PASSWORD='...'   # only if running migrations from CLI

# 1. Set edge function secrets (one-time)
pnpm exec supabase secrets set \
  CRON_SECRET="$(openssl rand -hex 32)" \
  TMDB_BEARER_TOKEN="$TMDB_READ_ACCESS_TOKEN" \
  OMDB_API_KEY="$OMDB_API_KEY" \
  TRAKT_CLIENT_ID="$TRAKT_CLIENT_ID" \
  --project-ref mgnbvhnhjresbnblytuk

# 2. Deploy all three functions
pnpm exec supabase functions deploy catalogue-ingest --project-ref mgnbvhnhjresbnblytuk --no-verify-jwt
pnpm exec supabase functions deploy omdb-enrich       --project-ref mgnbvhnhjresbnblytuk --no-verify-jwt
pnpm exec supabase functions deploy trakt-sync        --project-ref mgnbvhnhjresbnblytuk --no-verify-jwt

# 3. Add Vault secrets via Dashboard (UI only; not in CLI)
#    - catalogue_ingest_function_url
#    - omdb_enrich_function_url
#    - trakt_sync_function_url
#    - catalogue_ingest_cron_secret  (same value as CRON_SECRET above)

# 4. Apply the cron migrations (0009, 0010, 0011, 0012)
pnpm exec supabase db push --linked
```

`--no-verify-jwt` is intentional — this function does its own bearer auth
against `CRON_SECRET`. We don't want anon/service JWTs to be acceptable
because then a leaked anon key could trigger ingestion runs.

## Manual smoke test (after deploy)

```sh
curl -i -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"trending","regions":["US"],"kinds":["movie"],"limit":3,"dryRun":true}' \
  https://mgnbvhnhjresbnblytuk.functions.supabase.co/catalogue-ingest
```

Then verify a row landed in `public.catalogue_ingest_runs`.

## Cron schedules

| Job name                    | Cron         | Function          | Notes                                       |
| --------------------------- | ------------ | ----------------- | ------------------------------------------- |
| `catalogue_ingest_trending` | `7 * * * *`  | catalogue-ingest  | Hourly TMDB trending/day, all regions       |
| `catalogue_ingest_full`     | `0 3 * * *`  | catalogue-ingest  | Daily 03:00 UTC popular/now_playing/on_air  |
| `omdb_enrich_daily`         | `30 4 * * *` | omdb-enrich       | Daily 04:30 UTC, 100-title batch            |
| `trakt_sync_hourly`         | `13 * * * *` | trakt-sync        | Hourly trending watchers (movies + shows)   |

The catalogue-ingest schedules in migration `0009` ship with `dryRun: true`
for safety. Flip to `dryRun: false` after a manual smoke test confirms
write mode looks healthy. The OMDb and Trakt schedules in migration `0012`
ship with `dryRun: false` — they update existing rows only, so the blast
radius is limited.

## Global backfill

Migrations `0013_catalogue_backfill_runtime.sql` and
`0014_catalogue_backfill_candidates.sql` add persistent backfill jobs, cursors,
batch audit rows, and ordered TMDB export candidate snapshots. They also add two
scheduled backfill jobs:

| Job name | Cron | Payload |
| -------- | ---- | ------- |
| `catalogue_backfill_movie_step` | `*/5 * * * *` | `{"mode":"backfill_step","kind":"movie","dryRun":false,"limit":250}` |
| `catalogue_backfill_tv_step` | `2-59/5 * * * *` | `{"mode":"backfill_step","kind":"tv","dryRun":false,"limit":250}` |

Each step auto-starts a resumable job if none exists for that kind. It reads the
TMDB daily ID export once when the job is created, persists the candidates in
`catalogue_backfill_candidates`, processes one bounded batch, writes batch audit
rows, and advances `catalogue_backfill_cursors.next_offset`. Adult and
unreleased records are stored; app-side policy decides which records are
surfaced.

Manual smoke test:

```sh
curl -i -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"backfill_step","kind":"movie","dryRun":true,"limit":10,"maxCandidates":100}' \
  https://mgnbvhnhjresbnblytuk.functions.supabase.co/catalogue-ingest
```

Resume a specific job:

```sh
curl -i -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"backfill_step","jobId":"<job-uuid>","dryRun":false,"limit":250}' \
  https://mgnbvhnhjresbnblytuk.functions.supabase.co/catalogue-ingest
```

Status query:

```sql
select id, kind, status, processed_count, total_candidates, error_count, last_error
from public.catalogue_backfill_jobs
order by created_at desc;
```
