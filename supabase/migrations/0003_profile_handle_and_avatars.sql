-- 0003_profile_handle_and_avatars.sql
-- Adds handle column for unique user handles + Storage bucket for avatars.

-- ==========================================================================
-- Handle: lowercased, 3-20 chars, alnum + underscore (FSD 3.3.2).
-- Nullable to keep onboarding optional; enforced unique when set.
-- ==========================================================================
alter table public.profiles
  add column if not exists handle text;

create unique index if not exists profiles_handle_uniq
  on public.profiles (handle)
  where handle is not null;

alter table public.profiles
  drop constraint if exists profiles_handle_format;

alter table public.profiles
  add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');

-- ==========================================================================
-- Storage bucket for avatars. Public-read, owner-write.
-- ==========================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: owner write" on storage.objects;
create policy "avatars: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars: owner delete" on storage.objects;
create policy "avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
