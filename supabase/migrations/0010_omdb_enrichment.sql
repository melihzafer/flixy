-- 0010_omdb_enrichment.sql
-- Schema additions for OMDb enrichment (IMDb rating + votes + awards string).
-- The OMDb client lives in @flixy/catalogue-ingest and runs as a separate
-- pass after TMDB ingestion. Free tier: 1000 req/day.

alter table public.titles
  add column if not exists imdb_votes integer
    check (imdb_votes is null or imdb_votes >= 0),
  add column if not exists awards text,
  add column if not exists omdb_enriched_at timestamptz;

-- Surface stale-enrichment candidates cheaply: titles missing enrichment,
-- ordered by popularity. Partial index keeps it small (only covers rows
-- that need a top-up, not the whole catalogue).
create index if not exists titles_omdb_enrichment_idx
  on public.titles (popularity desc)
  where omdb_enriched_at is null;
