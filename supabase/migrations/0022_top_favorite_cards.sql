-- 0022_top_favorite_cards.sql
-- Community recommendation signal: popular saved and top-picked cards from
-- other users, excluding the caller's active watchlist and swipe history.

create or replace function public.get_top_favorite_cards(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  title_id uuid,
  save_count bigint,
  top_count bigint
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
  select
    w.title_id,
    count(*)::bigint as save_count,
    count(*) filter (where w.priority = 'top')::bigint as top_count
  from public.watchlist_items w
  where w.user_id <> v_uid
    and w.removed_at is null
    and w.watched_at is null
    and w.title_id not in (
      select own.title_id
      from public.watchlist_items own
      where own.user_id = v_uid
        and own.removed_at is null
    )
    and w.title_id not in (
      select s.title_id
      from public.swipes s
      where s.user_id = v_uid
        and s.is_undone = false
    )
  group by w.title_id
  order by top_count desc, save_count desc, max(w.added_at) desc
  limit greatest(0, p_limit);
end;
$$;

revoke all on function public.get_top_favorite_cards(uuid, integer) from public, anon;
grant execute on function public.get_top_favorite_cards(uuid, integer) to authenticated;
