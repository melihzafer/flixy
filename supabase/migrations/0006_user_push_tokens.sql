-- 0006_user_push_tokens.sql
-- Push token registry for notification delivery. The mobile client writes the
-- current Expo token after permission is granted; workers read active tokens
-- when composing notification batches.

create table if not exists public.user_push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios', 'android', 'web', 'windows', 'macos')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at  timestamptz,
  unique (user_id, token)
);

create index if not exists user_push_tokens_user_active_idx
  on public.user_push_tokens (user_id, updated_at desc)
  where disabled_at is null;

create index if not exists user_push_tokens_token_idx
  on public.user_push_tokens (token);

drop trigger if exists user_push_tokens_set_updated_at on public.user_push_tokens;
create trigger user_push_tokens_set_updated_at
  before update on public.user_push_tokens
  for each row execute function public.tg_set_updated_at();

alter table public.user_push_tokens enable row level security;

drop policy if exists "user_push_tokens: owner read" on public.user_push_tokens;
create policy "user_push_tokens: owner read"
  on public.user_push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "user_push_tokens: owner insert" on public.user_push_tokens;
create policy "user_push_tokens: owner insert"
  on public.user_push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_push_tokens: owner update" on public.user_push_tokens;
create policy "user_push_tokens: owner update"
  on public.user_push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_push_tokens: owner delete" on public.user_push_tokens;
create policy "user_push_tokens: owner delete"
  on public.user_push_tokens for delete
  using (auth.uid() = user_id);
