-- 0019_recommendations_hardening.sql
-- Security hardening for the recommendation RPCs added in 0018.
--
-- 0018's SECURITY DEFINER functions trusted the caller-supplied p_user_id and
-- were executable by `anon` — so any caller could pass another user's id and
-- read that user's watchlist-derived recommendations (cross-user leak, flagged
-- by the Supabase security advisor 0028/0029). This migration:
--   * binds the queries to auth.uid() instead of the supplied p_user_id
--     (the param is kept only so the existing client RPC signature resolves),
--   * locks EXECUTE to the roles that should actually call each function,
--   * pins title_api_uuid's search_path (advisor 0011).

-- 1. Content-based: bind to the authenticated caller, ignore p_user_id.
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
  v_profile_vector vector(1536);
begin
  -- Anonymous / unauthenticated callers get nothing.
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

-- 2. Collaborative: same binding.
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
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  with user_watchlist as (
    select w.title_id
    from public.watchlist_items w
    where w.user_id = v_uid
      and w.removed_at is null
  ),
  similar_users as (
    select w.user_id, count(*) as overlap_count
    from public.watchlist_items w
    where w.title_id in (select u.title_id from user_watchlist u)
      and w.user_id != v_uid
      and w.removed_at is null
    group by w.user_id
    order by overlap_count desc
    limit 100
  )
  select
    w.title_id,
    count(w.title_id) as co_occurrence_count
  from public.watchlist_items w
  join similar_users su on su.user_id = w.user_id
  where w.title_id not in (select u.title_id from user_watchlist u)
    and w.title_id not in (
      select s.title_id from public.swipes s where s.user_id = v_uid and s.is_undone = false
    )
    and w.removed_at is null
  group by w.title_id
  order by co_occurrence_count desc, random()
  limit p_limit;
end;
$$;

-- 3. Lock execution. Recommendation RPCs: authenticated users only.
revoke all on function public.recommend_titles_by_watchlist(uuid, integer) from public, anon;
grant execute on function public.recommend_titles_by_watchlist(uuid, integer) to authenticated;

revoke all on function public.get_collaborative_recommendations(uuid, integer) from public, anon;
grant execute on function public.get_collaborative_recommendations(uuid, integer) to authenticated;

-- get_titles_needing_embeddings is only for the service-role embed-titles job.
revoke all on function public.get_titles_needing_embeddings(integer) from public, anon, authenticated;
grant execute on function public.get_titles_needing_embeddings(integer) to service_role;

-- 4. Pin search_path on the pure helper (advisor 0011).
alter function public.title_api_uuid(integer, text) set search_path = pg_catalog;
