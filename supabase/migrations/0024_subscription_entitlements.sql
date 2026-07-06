-- Subscription-ready plans, entitlement snapshots, and atomic discovery sessions.

create table if not exists public.plans (
  id text primary key,
  name text not null,
  tier_rank integer not null,
  is_public boolean not null default true,
  is_mvp_available boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, key)
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  plan_id text not null references public.plans(id),
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'grace', 'cancelled', 'expired', 'refunded')
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_subscriptions_provider_id_idx
  on public.user_subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists user_subscriptions_effective_idx
  on public.user_subscriptions (user_id, status, current_period_end desc);

create table if not exists public.usage_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_device_id text,
  window_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  sessions_started integer not null default 0 check (sessions_started >= 0),
  cards_served integer not null default 0 check (cards_served >= 0),
  swipes_recorded integer not null default 0 check (swipes_recorded >= 0),
  saves_recorded integer not null default 0 check (saves_recorded >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or nullif(trim(anonymous_device_id), '') is not null)
);

create unique index if not exists usage_windows_user_period_idx
  on public.usage_windows (user_id, window_key, period_start)
  where user_id is not null;
create unique index if not exists usage_windows_device_period_idx
  on public.usage_windows (anonymous_device_id, window_key, period_start)
  where user_id is null;

create table if not exists public.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_device_id text,
  plan_id text not null references public.plans(id),
  mode text not null check (
    mode in ('main_deck', 'cold_start', 'blind_date', 'streaming_roulette', 'watchlist_triage', 'trailers')
  ),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  cards_limit integer check (cards_limit is null or cards_limit > 0),
  cards_served integer not null default 0 check (cards_served >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or nullif(trim(anonymous_device_id), '') is not null)
);

create index if not exists discovery_sessions_user_started_idx
  on public.discovery_sessions (user_id, started_at desc);
create index if not exists discovery_sessions_device_started_idx
  on public.discovery_sessions (anonymous_device_id, started_at desc);

create table if not exists public.session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.discovery_sessions(id) on delete cascade,
  title_id uuid,
  tmdb_id integer,
  media_type text check (media_type is null or media_type in ('movie', 'tv')),
  position integer not null check (position >= 0),
  source text,
  shown_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, position)
);

insert into public.plans (id, name, tier_rank, is_public, is_mvp_available, description)
values
  ('free', 'Free', 0, true, true, 'Daily discovery habit.'),
  ('bronze', 'Flixy Bronze', 10, true, true, 'Unlimited discovery.'),
  ('gold', 'Flixy Gold', 20, true, true, 'Smarter discovery.'),
  ('platinum', 'Flixy Platinum', 30, true, false, 'Shared discovery, coming later.')
on conflict (id) do update set
  name = excluded.name,
  tier_rank = excluded.tier_rank,
  is_public = excluded.is_public,
  is_mvp_available = excluded.is_mvp_available,
  description = excluded.description,
  updated_at = now();

with entitlement_seed(plan_id, entitlements) as (
  values
    ('free', '{"daily_session_limit":3,"cards_per_session":12,"unlimited_discovery":false,"basic_filters":true,"extended_filters":false,"advanced_filters":false,"mood_filters":false,"runtime_filters":false,"country_language_filters":false,"score_filters":false,"blind_date_mode":"teaser","streaming_roulette":"teaser","watchlist_triage":"limited","smart_watchlist":false,"taste_profile_depth":"basic","smart_notifications":"basic","realtime_matching":false,"shared_rooms":false,"max_room_members":1,"platinum_coming_soon":false}'::jsonb),
    ('bronze', '{"daily_session_limit":null,"cards_per_session":null,"unlimited_discovery":true,"basic_filters":true,"extended_filters":true,"advanced_filters":false,"mood_filters":false,"runtime_filters":false,"country_language_filters":false,"score_filters":false,"blind_date_mode":"full","streaming_roulette":"full","watchlist_triage":"full","smart_watchlist":false,"taste_profile_depth":"standard","smart_notifications":"basic_plus","realtime_matching":false,"shared_rooms":false,"max_room_members":1,"platinum_coming_soon":false}'::jsonb),
    ('gold', '{"daily_session_limit":null,"cards_per_session":null,"unlimited_discovery":true,"basic_filters":true,"extended_filters":true,"advanced_filters":true,"mood_filters":true,"runtime_filters":true,"country_language_filters":true,"score_filters":true,"blind_date_mode":"full","streaming_roulette":"full","watchlist_triage":"smart","smart_watchlist":true,"taste_profile_depth":"deep","smart_notifications":"full","realtime_matching":false,"shared_rooms":false,"max_room_members":1,"platinum_coming_soon":false}'::jsonb),
    ('platinum', '{"daily_session_limit":null,"cards_per_session":null,"unlimited_discovery":true,"basic_filters":true,"extended_filters":true,"advanced_filters":true,"mood_filters":true,"runtime_filters":true,"country_language_filters":true,"score_filters":true,"blind_date_mode":"group","streaming_roulette":"group","watchlist_triage":"smart","smart_watchlist":true,"taste_profile_depth":"group","smart_notifications":"shared","realtime_matching":true,"shared_rooms":true,"max_room_members":6,"platinum_coming_soon":true}'::jsonb)
)
insert into public.plan_entitlements (plan_id, key, value)
select seed.plan_id, item.key, item.value
from entitlement_seed seed
cross join lateral jsonb_each(seed.entitlements) item
on conflict (plan_id, key) do update set value = excluded.value, updated_at = now();

create or replace function public.resolve_entitlement_snapshot(target_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with effective_plan as (
    select coalesce((
      select us.plan_id
      from public.user_subscriptions us
      join public.plans p on p.id = us.plan_id
      where us.user_id = target_user_id
        and us.status in ('active', 'trialing', 'grace')
        and (us.current_period_end is null or us.current_period_end > now())
        and p.is_mvp_available
      order by p.tier_rank desc, us.created_at desc
      limit 1
    ), 'free') as plan_id
  )
  select jsonb_build_object(
    'plan_id', ep.plan_id,
    'entitlements', coalesce(jsonb_object_agg(pe.key, pe.value), '{}'::jsonb)
  )
  from effective_plan ep
  join public.plan_entitlements pe on pe.plan_id = ep.plan_id
  group by ep.plan_id;
$$;

revoke all on function public.resolve_entitlement_snapshot(uuid) from public, anon, authenticated;

create or replace function public.get_my_entitlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
begin
  snapshot := public.resolve_entitlement_snapshot(auth.uid());
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    snapshot := jsonb_set(snapshot, '{entitlements,daily_session_limit}', '1'::jsonb);
    snapshot := jsonb_set(snapshot, '{entitlements,cards_per_session}', '8'::jsonb);
  end if;
  return snapshot;
end;
$$;

grant execute on function public.get_my_entitlements() to anon, authenticated;

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
  period_start_at timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  period_end_at timestamptz := (date_trunc('day', now() at time zone 'utc') + interval '1 day') at time zone 'utc';
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

  perform pg_advisory_xact_lock(hashtextextended(
    coalesce(caller_id::text, 'device:' || device_id) || ':' || period_start_at::text,
    0
  ));

  select * into window_row
  from public.usage_windows uw
  where uw.window_key = 'discovery_daily'
    and uw.period_start = period_start_at
    and ((caller_id is not null and uw.user_id = caller_id)
      or (caller_id is null and uw.user_id is null and uw.anonymous_device_id = device_id))
  for update;

  if not found then
    insert into public.usage_windows (
      user_id, anonymous_device_id, window_key, period_start, period_end
    ) values (
      caller_id, case when caller_id is null then device_id else null end,
      'discovery_daily', period_start_at, period_end_at
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
      'period_end', period_end_at,
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
    'period_end', period_end_at,
    'entitlements', entitlements
  );
end;
$$;

grant execute on function public.start_discovery_session(text, integer, text) to anon, authenticated;

-- Legacy swipe session UUIDs were app-launch identifiers. Keep those rows valid,
-- then attach all new swipes to server-created discovery sessions where possible.
alter table public.swipes alter column session_id drop not null;
alter table public.swipes
  add constraint swipes_discovery_session_fkey
  foreign key (session_id) references public.discovery_sessions(id) on delete set null
  not valid;

alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.usage_windows enable row level security;
alter table public.discovery_sessions enable row level security;
alter table public.session_items enable row level security;

create policy "plans: public read" on public.plans for select using (is_public);
create policy "plan entitlements: public read" on public.plan_entitlements for select
  using (exists (select 1 from public.plans p where p.id = plan_id and p.is_public));
create policy "subscriptions: owner read" on public.user_subscriptions for select
  using (auth.uid() = user_id);
create policy "usage windows: owner read" on public.usage_windows for select
  using (auth.uid() = user_id);
create policy "discovery sessions: owner read" on public.discovery_sessions for select
  using (auth.uid() = user_id);
create policy "session items: owner read" on public.session_items for select
  using (exists (
    select 1 from public.discovery_sessions ds
    where ds.id = session_id and ds.user_id = auth.uid()
  ));

revoke insert, update, delete on public.user_subscriptions from anon, authenticated;
revoke insert, update, delete on public.usage_windows from anon, authenticated;
revoke insert, update, delete on public.discovery_sessions from anon, authenticated;
revoke insert, update, delete on public.session_items from anon, authenticated;

comment on table public.user_subscriptions is
  'Server-controlled provider subscription state. Client roles have read-only owner access.';
comment on function public.start_discovery_session(text, integer, text) is
  'Atomically enforces daily session quota and creates one discovery card batch.';
