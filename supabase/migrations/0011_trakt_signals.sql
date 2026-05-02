-- 0011_trakt_signals.sql
-- Trakt trending signal columns. Trakt watchers count is a real-time
-- popularity proxy that complements TMDB's slower trending/day curve.
-- The deck ranker blends both later.

alter table public.titles
  add column if not exists trakt_watchers integer
    check (trakt_watchers is null or trakt_watchers >= 0),
  add column if not exists trakt_synced_at timestamptz;

-- Hot-list lookups: titles trending on Trakt right now.
create index if not exists titles_trakt_watchers_idx
  on public.titles (trakt_watchers desc nulls last)
  where trakt_watchers is not null;
