# embed-titles

Backfills title plot embeddings for the content-based recommender
(`recommend_titles_by_watchlist`, migrations `0018_recommendations.sql` /
`0021_embeddings_gte_small.sql`).

## What it does

1. Calls the `get_titles_needing_embeddings(p_limit)` RPC — titles with a
   non-empty synopsis that do not yet have a row in `title_embeddings`,
   most-popular first.
2. Embeds `title + genres + synopsis` with Supabase's built-in **gte-small**
   model (`Supabase.ai.Session`) — 384 dims, matching `vector(384)`. Runs
   in-process: no external API, no key, no cost.
3. Upserts into `title_embeddings`, keyed by the **deterministic TMDB UUID**
   (`title_api_uuid` / `apps/mobile/src/lib/tmdb.ts::tmdbIdToUuid`) — the same
   id space the mobile client and `watchlist_items` use, so the recommender
   join resolves and returned ids are client-resolvable.

Idempotent: already-embedded titles are excluded by the RPC, so re-running
only fills gaps. Run it in small cron batches to backfill the catalogue.

## Required env

| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` | project url (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | bypass RLS for writes (auto-injected) |
| `CRON_SECRET` | bearer auth for the function |

No `OPENAI_API_KEY` (or any model key) is needed — embeddings are generated
locally by the edge runtime.

## Invoke

```bash
curl -X POST "$SUPABASE_URL/functions/v1/embed-titles" \
  -H "authorization: Bearer $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{ "batchSize": 100, "dryRun": false }'
```

Response: `{ ok, dryRun, candidateCount, embeddedCount, skippedCount, failedCount }`.

## Cron

Schedule like the other ingest functions (small batch, off-peak) until the
catalogue is fully embedded, then keep a low-frequency job to cover newly
ingested titles.
