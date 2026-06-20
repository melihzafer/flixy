-- 0021_embeddings_gte_small.sql
-- Switch the recommender embeddings from OpenAI text-embedding-3-small
-- (1536-dim) to Supabase's built-in gte-small model (384-dim). gte-small runs
-- in-process inside the edge function, so the embed-titles job becomes
-- zero-cost and needs no external API key.
--
-- title_embeddings is empty at this point, so we recreate the vector column
-- (and its HNSW index) rather than attempt an incompatible type cast.

drop index if exists public.title_embeddings_hnsw_idx;

alter table public.title_embeddings drop column if exists embedding;
alter table public.title_embeddings add column embedding vector(384) not null;

create index if not exists title_embeddings_hnsw_idx
  on public.title_embeddings
  using hnsw (embedding vector_cosine_ops);

-- Recreate the content-based recommender with the 384-dim profile vector,
-- preserving the auth.uid() binding from 0019.
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
  v_uid uuid := auth.uid();
  v_profile_vector vector(384);
begin
  if v_uid is null then
    return;
  end if;

  select avg(te.embedding)
  into v_profile_vector
  from public.watchlist_items w
  join public.title_embeddings te on te.title_id = w.title_id
  where w.user_id = v_uid
    and w.removed_at is null
    and w.watched_at is null;

  if v_profile_vector is null then
    return;
  end if;

  return query
  select
    te.title_id,
    (1 - (te.embedding <=> v_profile_vector))::numeric as similarity
  from public.title_embeddings te
  where te.title_id not in (
    select w.title_id from public.watchlist_items w where w.user_id = v_uid and w.removed_at is null
    union
    select s.title_id from public.swipes s where s.user_id = v_uid and s.is_undone = false
  )
  order by te.embedding <=> v_profile_vector
  limit p_limit;
end;
$$;

-- create or replace preserves ACL, but re-assert the 0019 lockdown defensively.
revoke all on function public.recommend_titles_by_watchlist(uuid, integer) from public, anon;
grant execute on function public.recommend_titles_by_watchlist(uuid, integer) to authenticated;
