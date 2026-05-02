# catalogue-ingest

Supabase Edge Function that runs server-side TMDB catalogue ingestion on a
cron schedule. Invoked by `pg_cron` via `pg_net.http_post` with a shared
`CRON_SECRET` bearer token.

## Status

**Pass 1 (current)** — scaffolding only. Validates auth, parses request
body, writes a placeholder row to `public.catalogue_ingest_runs`, and
returns the planned scope. The actual TMDB ingestion logic is not yet
ported from `@flixy/catalogue-ingest`.

**Pass 2 (next)** — port the mapper, TMDB client, and Supabase writer
from `packages/catalogue-ingest` so the function performs real
ingestion. The Node CLI in that package stays as the canonical
implementation for ad-hoc backfills.

## Required env vars (set in Supabase Dashboard → Edge Functions → Secrets)

| Name                        | Auto-injected? | Notes                                                                 |
| --------------------------- | -------------- | --------------------------------------------------------------------- |
| `SUPABASE_URL`              | Yes            | Provided by the platform.                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes            | Provided by the platform; used for catalogue writes.                  |
| `CRON_SECRET`               | **No**         | Random 32+ byte token shared with `pg_cron` callers via Vault.        |
| `TMDB_BEARER_TOKEN`         | **No**         | TMDB v4 read-access token. (Not used in pass 1 stub.)                 |

## Required Vault secrets (Supabase Dashboard → Project Settings → Vault)

These are read by the cron migration `0009_catalogue_ingest_cron.sql` so
`pg_net` knows where to post and which token to send.

| Vault secret name                  | Value                                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| `catalogue_ingest_function_url`    | `https://<project-ref>.functions.supabase.co/catalogue-ingest`     |
| `catalogue_ingest_cron_secret`     | Same value as the `CRON_SECRET` edge function env var.             |

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
  --project-ref mgnbvhnhjresbnblytuk

# 2. Deploy the function
pnpm exec supabase functions deploy catalogue-ingest \
  --project-ref mgnbvhnhjresbnblytuk \
  --no-verify-jwt

# 3. Add Vault secrets via Dashboard (UI only; not in CLI)
#    - catalogue_ingest_function_url
#    - catalogue_ingest_cron_secret  (same value as CRON_SECRET above)

# 4. Apply the cron migration
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

## Cron schedules (defined in migration 0009)

| Job name                   | Cron        | Mode     | Notes                                       |
| -------------------------- | ----------- | -------- | ------------------------------------------- |
| `catalogue_ingest_trending`| `7 * * * *` | trending | Hourly TMDB trending/day, all regions       |
| `catalogue_ingest_full`    | `0 3 * * *` | full     | Daily 03:00 UTC popular/now_playing/on_air  |

Both currently send `dryRun: true` so the first deployment cannot write
catalogue rows. Switch to `dryRun: false` (in migration 0009 or via a
new migration) once pass 2 lands and you've verified a manual write run.
