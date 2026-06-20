-- 0018_recommendations.sql
-- Personalization & Recommendation Engine (FSD section 3.5.3 section upgrade)
-- Integrates content-based similarity using pgvector + collaborative filtering.

-- 1. Enable pgvector extension (must be done in public/pre-configured schema)
create extension if not exists vector;

-- 2. Create title embeddings table to store 1536-dimensional OpenAI embeddings.
--    Keyed by the DETERMINISTIC TMDB UUID (apps/mobile/src/lib/tmdb.ts ::
--    tmdbIdToUuid) — the same id space as watchlist_items.title_id and the
--    mobile catalogue. Deliberately NO FK to titles(id): catalogue rows use
--    random gen_random_uuid() ids, but recommendations must emit the
--    deterministic id the client can resolve back to a TMDB title.
create table if not exists public.title_embeddings (
  title_id   uuid primary key,
  embedding  vector(1536) not null
);

-- Self-heal: an earlier version of this migration FK'd title_id to titles(id)
-- (the random catalogue id). Drop it so the column can hold the deterministic
-- TMDB UUID. No-op on fresh installs.
alter table public.title_embeddings
  drop constraint if exists title_embeddings_title_id_fkey;

-- 3. HNSW index for rapid cosine similarity searches (HNSW is faster than IVFFlat for dynamic catalogs)
create index if not exists title_embeddings_hnsw_idx 
  on public.title_embeddings 
  using hnsw (embedding vector_cosine_ops);

-- 4. Enable RLS and setup policies
alter table public.title_embeddings enable row level security;

drop policy if exists "title_embeddings: public read" on public.title_embeddings;
create policy "title_embeddings: public read"
  on public.title_embeddings for select
  using (true);

-- 5. PG Function: Recommend titles by watchlist cosine similarity (Content-Based)
create or replace function public.recommend_titles_by_watchlist(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  title_id uuid,
  similarity numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_vector vector(1536);
begin
  -- Compute the average embedding vector of titles in the user's active
  -- watchlist. pgvector provides avg(vector) (>= 0.5.0); there is no
  -- vector_avg(). watchlist_items.title_id and title_embeddings.title_id are
  -- both the deterministic TMDB UUID, so this join now resolves.
  select avg(te.embedding)
  into v_profile_vector
  from public.watchlist_items w
  join public.title_embeddings te on te.title_id = w.title_id
  where w.user_id = p_user_id
    and w.removed_at is null
    and w.watched_at is null;

  -- If the user has no active watchlist, return empty (fallback to popularity)
  if v_profile_vector is null then
    return;
  end if;

  -- Return top similar titles that the user hasn't interacted with yet
  return query
  select 
    te.title_id,
    (1 - (te.embedding <=> v_profile_vector))::numeric as similarity
  from public.title_embeddings te
  where te.title_id not in (
    select w.title_id from public.watchlist_items w where w.user_id = p_user_id and w.removed_at is null
    union
    select s.title_id from public.swipes s where s.user_id = p_user_id and s.is_undone = false
  )
  order by te.embedding <=> v_profile_vector
  limit p_limit;
end;
$$;

-- 6. PG Function: Recommend titles by similar user watchlists (Collaborative Filtering)
create or replace function public.get_collaborative_recommendations(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  title_id uuid,
  co_occurrence_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with user_watchlist as (
    -- Titles in current user's watchlist
    select w.title_id 
    from public.watchlist_items w 
    where w.user_id = p_user_id 
      and w.removed_at is null
  ),
  similar_users as (
    -- Find users who share at least one watchlist item
    select w.user_id, count(*) as overlap_count
    from public.watchlist_items w
    where w.title_id in (select u.title_id from user_watchlist u)
      and w.user_id != p_user_id
      and w.removed_at is null
    group by w.user_id
    order by overlap_count desc
    limit 100
  )
  -- Find unseen titles from similar users' watchlists
  select 
    w.title_id,
    count(w.title_id) as co_occurrence_count
  from public.watchlist_items w
  join similar_users su on su.user_id = w.user_id
  where w.title_id not in (select u.title_id from user_watchlist u)
    and w.title_id not in (
      select s.title_id from public.swipes s where s.user_id = p_user_id and s.is_undone = false
    )
    and w.removed_at is null
  group by w.title_id
  order by co_occurrence_count desc, random()
  limit p_limit;
end;
$$;

-- 7. Deterministic TMDB UUID, mirrored from apps/mobile/src/lib/tmdb.ts.
--    movie -> variant a000, tv -> variant b000, tmdb id zero-padded to 12.
--    Used to bridge the random catalogue id space (titles.id) and the
--    deterministic id space the mobile client + embeddings/watchlist speak.
create or replace function public.title_api_uuid(
  p_tmdb_id integer,
  p_content_type text
)
returns uuid
language sql
immutable
as $$
  select (
    '00000000-0000-4000-'
    || case when p_content_type = 'movie' then 'a000' else 'b000' end
    || '-'
    || lpad(p_tmdb_id::text, 12, '0')
  )::uuid;
$$;

-- 8. PG Function: titles that still need an embedding (consumed by the
--    embed-titles edge function). Returns the deterministic api_uuid so the
--    job can upsert directly into title_embeddings.title_id. Most popular
--    first so the catalogue users actually see gets embedded earliest.
create or replace function public.get_titles_needing_embeddings(
  p_limit integer default 100
)
returns table (
  tmdb_id      integer,
  content_type text,
  title        text,
  synopsis     text,
  genres       text[],
  api_uuid     uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    t.tmdb_id,
    t.content_type,
    t.title,
    t.synopsis,
    t.genres,
    public.title_api_uuid(t.tmdb_id, t.content_type) as api_uuid
  from public.titles t
  where t.synopsis is not null
    and length(btrim(t.synopsis)) > 0
    and not exists (
      select 1
      from public.title_embeddings te
      where te.title_id = public.title_api_uuid(t.tmdb_id, t.content_type)
    )
  order by t.popularity desc nulls last
  limit p_limit;
$$;
