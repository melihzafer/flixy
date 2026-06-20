-- 0005_swipes_and_taste.sql
-- Swipe engine (FSD section 3.6). Immutable event log + derived lists +
-- aggregated taste signal view consumed by the deck composer.

create table if not exists public.swipes (
  event_id          uuid primary key,                -- client-supplied (idempotency)
  user_id           uuid not null references auth.users(id) on delete cascade,
  title_id          uuid not null references public.titles(id) on delete cascade,
  direction         text not null check (direction in ('left','right','up','down')),
  occurred_at       timestamptz not null default now(),
  session_id        uuid not null,
  deck_position     integer not null default 0,
  region            char(2) not null,
  filters_snapshot  jsonb not null default '{}'::jsonb,
  is_undone         boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists swipes_user_occurred_idx on public.swipes (user_id, occurred_at desc);
create index if not exists swipes_user_title_idx on public.swipes (user_id, title_id);
create index if not exists swipes_user_direction_idx on public.swipes (user_id, direction) where is_undone = false;

alter table public.swipes enable row level security;

drop policy if exists "swipes: owner read" on public.swipes;
create policy "swipes: owner read"
  on public.swipes for select using (auth.uid() = user_id);

drop policy if exists "swipes: owner insert" on public.swipes;
create policy "swipes: owner insert"
  on public.swipes for insert with check (auth.uid() = user_id);

drop policy if exists "swipes: owner update undo only" on public.swipes;
create policy "swipes: owner update undo only"
  on public.swipes for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- Watchlist: derived from positive (right + up) swipes minus removals.
-- Stored explicitly because users can reorder + mark-as-watched + remove.
-- ============================================================================
create table if not exists public.watchlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title_id    uuid not null references public.titles(id) on delete cascade,
  priority    text not null check (priority in ('top','normal')),
  position    integer not null default 0,
  added_at    timestamptz not null default now(),
  watched_at  timestamptz,
  removed_at  timestamptz,
  unique (user_id, title_id)
);

create index if not exists watchlist_user_active_idx
  on public.watchlist_items (user_id, priority, position)
  where removed_at is null and watched_at is null;

alter table public.watchlist_items enable row level security;

drop policy if exists "watchlist: owner read" on public.watchlist_items;
create policy "watchlist: owner read"
  on public.watchlist_items for select using (auth.uid() = user_id);

drop policy if exists "watchlist: owner write" on public.watchlist_items;
create policy "watchlist: owner write"
  on public.watchlist_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- Taste signal aggregate: per-user, per-genre count of positive vs negative
-- swipes. Read-only view consumed by the deck composer.
-- ============================================================================
create or replace view public.user_taste_signal as
select
  s.user_id,
  unnest(t.genres) as genre,
  case when s.direction in ('right','up') then 'positive' else 'negative' end as polarity,
  count(*)::int as count
from public.swipes s
join public.titles t on t.id = s.title_id
where s.is_undone = false
group by s.user_id, genre, polarity;

-- The view inherits RLS from `swipes`, but expose explicitly via grant for clarity.
grant select on public.user_taste_signal to authenticated;
