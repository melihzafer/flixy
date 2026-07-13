-- Preserve enough swipe metadata to learn language/type passes without a
-- catalogue re-fetch, then make the vector profile reflect the current
-- watchlist state: Top 5x, watched 3x, saved 2x.

alter table public.swipes
  add column if not exists title_snapshot jsonb;

comment on column public.swipes.title_snapshot is
  'Client snapshot of genres, original language, and kind for pass learning; nullable for historical rows.';

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

  -- Repeat each current list item's embedding by its highest state weight.
  -- A Top item that is also watched remains 5x rather than being counted twice.
  select avg(weighted.embedding)
  into v_profile_vector
  from (
    select te.embedding
    from public.watchlist_items w
    join public.title_embeddings te on te.title_id = w.title_id
    cross join lateral generate_series(
      1,
      case
        when w.priority = 'top' then 5
        when w.watched_at is not null then 3
        else 2
      end
    ) as weight_copy
    where w.user_id = v_uid
      and w.removed_at is null
  ) as weighted;

  if v_profile_vector is null then
    return;
  end if;

  return query
  select
    te.title_id,
    (1 - (te.embedding <=> v_profile_vector))::numeric as similarity
  from public.title_embeddings te
  where te.title_id not in (
    select w.title_id
    from public.watchlist_items w
    where w.user_id = v_uid and w.removed_at is null
    union
    select s.title_id
    from public.swipes s
    where s.user_id = v_uid and s.is_undone = false
  )
  order by te.embedding <=> v_profile_vector
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

revoke all on function public.recommend_titles_by_watchlist(uuid, integer) from public, anon;
grant execute on function public.recommend_titles_by_watchlist(uuid, integer) to authenticated;
