-- Swipes use the same deterministic TMDB UUID namespace as watchlist_items.
-- Catalogue metadata is API-backed, so a title does not necessarily have a
-- row in public.titles. Migration 0016 removed this obsolete FK from the
-- watchlist but left it on swipes, causing valid queued events to fail sync.

alter table public.swipes
  drop constraint if exists swipes_title_id_fkey;

comment on column public.swipes.title_id is
  'Deterministic TMDB UUID from apps/mobile/src/lib/tmdb.ts; no titles FK because catalogue data is API-backed.';

create index if not exists swipes_user_title_active_idx
  on public.swipes (user_id, title_id)
  where is_undone = false;
