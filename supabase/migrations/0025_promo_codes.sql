-- Promo code system: server-controlled redemption grants plan access.
-- Seeds MZHUNLIMITED (perpetual Gold) and MZH1 (1 month Gold bonus).

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan_id text not null references public.plans(id) on delete restrict,
  duration_days integer check (duration_days is null or duration_days > 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on public.promo_codes (code);

create table if not exists public.redeemed_promo_codes (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

create index if not exists redeemed_promo_codes_user_idx
  on public.redeemed_promo_codes (user_id, redeemed_at desc);

insert into public.promo_codes (code, plan_id, duration_days, is_active, note) values
  ('MZHUNLIMITED', 'gold', null, true, 'MZH unlimited Gold — perpetual'),
  ('MZH1', 'gold', 30, true, 'MZH 1 month Gold bonus')
on conflict (code) do update set
  plan_id = excluded.plan_id,
  duration_days = excluded.duration_days,
  is_active = excluded.is_active,
  note = excluded.note,
  updated_at = now();

create or replace function public.redeem_promo_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(btrim(input_code));
  promo public.promo_codes;
  caller_id uuid := auth.uid();
  period_start timestamptz := now();
  period_end timestamptz;
  new_sub public.user_subscriptions;
  already_redeemed bigint;
  is_anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if caller_id is null or is_anon then
    raise exception using errcode = '28000', message = 'auth_required';
  end if;
  if normalized = '' then
    raise exception using errcode = '22023', message = 'invalid_promo_code';
  end if;

  select * into promo
  from public.promo_codes
  where code = normalized
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'invalid_promo_code';
  end if;

  if not promo.is_active or (promo.starts_at is not null and now() < promo.starts_at) then
    raise exception using errcode = '55006', message = 'promo_inactive';
  end if;
  if promo.expires_at is not null and now() > promo.expires_at then
    raise exception using errcode = '55006', message = 'promo_expired';
  end if;
  if promo.max_redemptions is not null and promo.redeemed_count >= promo.max_redemptions then
    raise exception using errcode = '55006', message = 'promo_sold_out';
  end if;

  select count(*) into already_redeemed
  from public.redeemed_promo_codes
  where promo_code_id = promo.id and user_id = caller_id;
  if already_redeemed > 0 then
    raise exception using errcode = '55006', message = 'promo_already_redeemed';
  end if;

  period_end := case
    when promo.duration_days is null then null
    else now() + make_interval(days => promo.duration_days)
  end;

  insert into public.user_subscriptions (
    user_id, provider, plan_id, status,
    current_period_start, current_period_end
  ) values (
    caller_id, 'promo', promo.plan_id, 'active',
    period_start, period_end
  ) returning * into new_sub;

  insert into public.redeemed_promo_codes (promo_code_id, user_id, subscription_id)
  values (promo.id, caller_id, new_sub.id);

  update public.promo_codes
  set redeemed_count = redeemed_count + 1, updated_at = now()
  where id = promo.id;

  return jsonb_build_object(
    'ok', true,
    'plan_id', promo.plan_id,
    'duration_days', promo.duration_days,
    'current_period_end', period_end,
    'subscription_id', new_sub.id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'reason', coalesce(sqlerrm, 'promo_unknown_error')
    );
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;
revoke execute on function public.redeem_promo_code(text) from anon, public;

alter table public.promo_codes enable row level security;
alter table public.redeemed_promo_codes enable row level security;

-- Clients never enumerate promo codes; redemption is the only surface.
revoke select, insert, update, delete on public.promo_codes from anon, authenticated;
revoke select, insert, update, delete on public.redeemed_promo_codes from anon, authenticated;

create policy "redeemed promos: owner read" on public.redeemed_promo_codes for select
  using (auth.uid() = user_id);

comment on table public.promo_codes is
  'Server-controlled promo codes. Client roles cannot read or mutate; only redeem_promo_code RPC.';
comment on table public.redeemed_promo_codes is
  'Per-user redemption ledger. Owners can read their own redemptions.';
comment on function public.redeem_promo_code(text) is
  'Atomically validates and redeems a promo code, granting an active promo subscription.';