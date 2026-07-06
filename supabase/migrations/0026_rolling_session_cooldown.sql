-- Replace the calendar-day session quota with a rolling 1-hour cooldown:
-- once a plan's session allotment is used up, the window unlocks 1 hour
-- after it started (not at UTC midnight), then a fresh allotment begins.
-- Existing usage_windows rows are bookkeeping-only state, safe to clear.

delete from public.usage_windows;

create or replace function public.start_discovery_session(
  mode text,
  requested_cards integer default null,
  anonymous_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  device_id text := nullif(trim(anonymous_device_id), '');
  snapshot jsonb;
  resolved_plan text;
  entitlements jsonb;
  daily_limit integer;
  per_session_limit integer;
  card_limit integer;
  unlimited boolean;
  now_ts timestamptz := now();
  window_row public.usage_windows;
  created_session public.discovery_sessions;
  is_anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if mode not in ('main_deck', 'cold_start', 'blind_date', 'streaming_roulette', 'watchlist_triage', 'trailers') then
    raise exception using errcode = '22023', message = 'invalid_discovery_mode';
  end if;
  if caller_id is null and device_id is null then
    raise exception using errcode = '28000', message = 'discovery_identity_required';
  end if;
  if requested_cards is not null and (requested_cards < 1 or requested_cards > 100) then
    raise exception using errcode = '22023', message = 'requested_cards_out_of_range';
  end if;

  snapshot := public.resolve_entitlement_snapshot(caller_id);
  resolved_plan := snapshot ->> 'plan_id';
  entitlements := snapshot -> 'entitlements';
  if caller_id is null or is_anon then
    daily_limit := 1;
    per_session_limit := 8;
  else
    daily_limit := (entitlements ->> 'daily_session_limit')::integer;
    per_session_limit := (entitlements ->> 'cards_per_session')::integer;
  end if;
  unlimited := coalesce((entitlements ->> 'unlimited_discovery')::boolean, false)
    and caller_id is not null and not is_anon;
  card_limit := case
    when unlimited and requested_cards is null then null
    when per_session_limit is null then requested_cards
    when requested_cards is null then per_session_limit
    else least(requested_cards, per_session_limit)
  end;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(caller_id::text, 'device:' || device_id), 0));

  select * into window_row
  from public.usage_windows uw
  where uw.window_key = 'discovery_quota'
    and ((caller_id is not null and uw.user_id = caller_id)
      or (caller_id is null and uw.user_id is null and uw.anonymous_device_id = device_id))
  order by uw.period_start desc
  limit 1
  for update;

  -- No window yet, or the previous 1-hour window has elapsed: start a fresh one.
  if not found or window_row.period_end <= now_ts then
    insert into public.usage_windows (
      user_id, anonymous_device_id, window_key, period_start, period_end
    ) values (
      caller_id, case when caller_id is null then device_id else null end,
      'discovery_quota', now_ts, now_ts + interval '1 hour'
    )
    returning * into window_row;
  end if;

  if not unlimited and window_row.sessions_started >= daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'plan_id', resolved_plan,
      'cards_limit', per_session_limit,
      'remaining_sessions', 0,
      'period_end', window_row.period_end,
      'entitlements', entitlements
    );
  end if;

  insert into public.discovery_sessions (
    user_id, anonymous_device_id, plan_id, mode, cards_limit, cards_served
  ) values (
    caller_id, case when caller_id is null then device_id else null end,
    resolved_plan, mode, card_limit, coalesce(card_limit, requested_cards, 0)
  )
  returning * into created_session;

  update public.usage_windows
  set sessions_started = sessions_started + 1,
      cards_served = cards_served + coalesce(card_limit, requested_cards, 0),
      updated_at = now()
  where id = window_row.id
  returning * into window_row;

  return jsonb_build_object(
    'allowed', true,
    'session_id', created_session.id,
    'plan_id', resolved_plan,
    'cards_limit', card_limit,
    'remaining_sessions', case when unlimited then null else greatest(daily_limit - window_row.sessions_started, 0) end,
    'period_end', window_row.period_end,
    'entitlements', entitlements
  );
end;
$$;

comment on function public.start_discovery_session(text, integer, text) is
  'Atomically enforces a rolling 1-hour session quota (fresh allotment once the window elapses) and creates one discovery card batch.';
