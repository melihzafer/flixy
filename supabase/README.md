# Supabase

This directory holds the Postgres schema for Flixy as plain SQL migrations.

## Layout

- `migrations/NNNN_<name>.sql` — append-only, numerically ordered. Never edit a
  migration after it has been applied to a shared environment; add a new one.

## Apply

If using the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

Or via `psql` directly:

```bash
psql "$SUPABASE_DB_URL" -f migrations/0001_init_profiles.sql
```

## Conventions

- snake_case for tables / columns
- All user-owned tables have RLS enabled and self-only policies by default
- `updated_at` columns are wired to the shared `tg_set_updated_at()` trigger
- New auth.users automatically get a `public.profiles` row via `handle_new_user()`

## Catalogue ingestion

TMDB catalogue ingestion runs server-side through `@flixy/catalogue-ingest`; the
Expo app must never receive TMDB credentials. Runtime env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TMDB_BEARER_TOKEN` or `TMDB_API_KEY`
- optional `CATALOGUE_INGEST_REGIONS`, `CATALOGUE_INGEST_LIMIT`,
  `CATALOGUE_INGEST_LANGUAGE`, `TMDB_CACHE_TTL_HOURS`

Build first, then run a dry run before writes:

```bash
pnpm --filter @flixy/catalogue-ingest build
pnpm --filter @flixy/catalogue-ingest ingest -- --dry-run --region=US --tv=1100
pnpm --filter @flixy/catalogue-ingest ingest -- --write --region=US,TR
```

The writer upserts `titles` on `(tmdb_id, content_type)` without supplying `id`,
so existing title UUIDs and dependent foreign keys are preserved. Availability is
refreshed per title/region snapshot; `supabase db push` must apply migration
`0008_catalogue_ingestion_runtime.sql` before production writes.

### Global TMDB backfill

Migrations `0013_catalogue_backfill_runtime.sql` and
`0014_catalogue_backfill_candidates.sql` add resumable backfill state:
`catalogue_backfill_jobs`, `catalogue_backfill_cursors`,
`catalogue_backfill_batches`, and `catalogue_backfill_candidates`. They also
schedule small `backfill_step` cron calls for movies and TV. The backfill reads
TMDB daily export files once per job, stores an ordered candidate snapshot by
popularity, and processes bounded batches through the same mapper/writer as the
existing ingestion path.

Build first, then run a capped dry-run before writes:

```bash
pnpm --filter @flixy/catalogue-ingest build
pnpm --filter @flixy/catalogue-ingest ingest -- backfill --kind=movie --dry-run --max-candidates=100 --batch-size=10
pnpm --filter @flixy/catalogue-ingest ingest -- backfill --kind=tv --dry-run --max-candidates=100 --batch-size=10
```

Start or resume write-mode backfill steps:

```bash
pnpm --filter @flixy/catalogue-ingest ingest -- backfill --start --kind=movie --write --batch-size=250
pnpm --filter @flixy/catalogue-ingest ingest -- backfill --kind=movie --write --batch-size=250
pnpm --filter @flixy/catalogue-ingest ingest -- backfill --job-id=<job-uuid> --write --batch-size=250
```

Operational checks:

```sql
select public.catalogue_ingest_invoke(
  jsonb_build_object('mode','trending','dryRun',true,'limit',1)
) as request_id;
-- request_id must be non-null. NULL means Vault is missing
-- catalogue_ingest_function_url or catalogue_ingest_cron_secret.

select id, kind, status, processed_count, total_candidates, error_count
from public.catalogue_backfill_jobs
order by created_at desc;

select *
from public.catalogue_backfill_batches
where job_id = '<job-uuid>'
order by batch_number desc
limit 20;
```

Rollback a bad batch by deleting affected titles or re-queueing the failed IDs
only after checking downstream foreign keys. The `last_backfill_batch_id` column
identifies rows written by a specific batch.

See `docs/FSD.md § 2` for the full data architecture context.

### Export catalogue to Cloudflare R2

Use R2 for bulky public catalogue JSON while Supabase remains the source of
truth for auth, profiles, swipes, and watchlists. Do not commit R2 or service
role credentials; keep them in `.env.local`, shell env, or CI secrets.

Required env:

- `SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- optional `R2_BUCKET_NAME` (defaults to `flixy`)
- optional `R2_CATALOGUE_PREFIX` (defaults to `catalogue`)

Smoke-test one object first, then export the full public catalogue:

```bash
pnpm --filter @flixy/catalogue-ingest build
pnpm --filter @flixy/catalogue-ingest ingest -- r2-export --limit=1 --prefix=catalogue-smoke
pnpm --filter @flixy/catalogue-ingest ingest -- r2-export --prefix=catalogue --concurrency=8
```

If a long export is interrupted after the progress line says `N` titles, resume
objects from that offset, then publish the index/manifest:

```bash
pnpm --filter @flixy/catalogue-ingest ingest -- r2-export --prefix=catalogue --objects-only --offset=N --concurrency=16
pnpm --filter @flixy/catalogue-ingest ingest -- r2-export --prefix=catalogue --index-only
```

R2 object layout:

- `catalogue/titles/movie/<tmdb_id>.json.gz` — full title document with videos
  and availability embedded
- `catalogue/titles/tv/<tmdb_id>.json.gz` — full TV title document
- `catalogue/index/titles-index.json.gz` — slim browse/search index
- `catalogue/manifest.json` — export timestamp, counts, and index pointer

After a successful export, reclaim Supabase storage by truncating only runtime
cache/backfill tables after confirming R2 object counts and app read strategy.
Do not delete canonical user tables or title data until runtime reads have moved
off Postgres.
