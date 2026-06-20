-- 0016_watchlist_api_title_ids.sql
-- Watchlist rows store deterministic TMDB UUIDs from the mobile API layer.
-- Catalogue title metadata remains API-backed and is not persisted in Supabase.

create extension if not exists pgcrypto;

create table if not exists public.watchlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title_id    uuid not null,
  priority    text not null default 'normal' check (priority in ('top','normal')),
  position    integer not null default 0,
  added_at    timestamptz not null default now(),
  watched_at  timestamptz,
  removed_at  timestamptz,
  unique (user_id, title_id)
);

alter table public.watchlist_items
  drop constraint if exists watchlist_items_title_id_fkey;

comment on column public.watchlist_items.title_id is
  'Deterministic TMDB UUID from apps/mobile/src/lib/tmdb.ts; no titles FK because catalogue data is API-backed.';

create index if not exists watchlist_user_title_active_idx
  on public.watchlist_items (user_id, title_id)
  where removed_at is null;

create index if not exists watchlist_user_active_idx
  on public.watchlist_items (user_id, priority, position)
  where removed_at is null;

alter table public.watchlist_items enable row level security;

drop policy if exists "watchlist: owner read" on public.watchlist_items;
create policy "watchlist: owner read"
  on public.watchlist_items for select
  using ((select auth.uid()) = user_id);

drop policy if exists "watchlist: owner insert" on public.watchlist_items;
create policy "watchlist: owner insert"
  on public.watchlist_items for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist: owner update" on public.watchlist_items;
create policy "watchlist: owner update"
  on public.watchlist_items for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist: owner delete" on public.watchlist_items;
create policy "watchlist: owner delete"
  on public.watchlist_items for delete
  using ((select auth.uid()) = user_id);
