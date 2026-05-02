-- 0007_title_metadata_integrity.sql
-- Add authoritative metadata fields without breaking existing catalogue reads.

alter table public.titles
  add column if not exists content_rating text,
  add column if not exists critic_score integer check (critic_score is null or critic_score between 0 and 100),
  add column if not exists tagline text,
  add column if not exists directors text[] not null default '{}'::text[],
  add column if not exists creators text[] not null default '{}'::text[],
  add column if not exists "cast" text[] not null default '{}'::text[],
  add column if not exists tmdb_updated_at timestamptz;

create table if not exists public.title_videos (
  id           uuid primary key default gen_random_uuid(),
  title_id     uuid not null references public.titles(id) on delete cascade,
  provider     text not null default 'youtube',
  video_key    text not null,
  video_type   text not null,
  site         text not null default 'YouTube',
  official     boolean not null default false,
  language     text,
  region       char(2),
  published_at timestamptz,
  observed_at  timestamptz not null default now(),
  unique (title_id, provider, video_key)
);

create index if not exists title_videos_title_idx on public.title_videos (title_id);

alter table public.title_videos enable row level security;

drop policy if exists "title_videos: public read" on public.title_videos;
create policy "title_videos: public read"
  on public.title_videos for select
  using (true);

update public.titles
set title = 'Schindler''s List'
where tmdb_id = 424
  and content_type = 'movie'
  and title = 'Schindlers List';

insert into public.titles
  (tmdb_id, content_type, title, original_title, synopsis, poster_url, release_year, runtime_minutes, content_rating, imdb_rating, popularity, genres, language, creators, "cast")
values
  (
    1100,
    'tv',
    'How I Met Your Mother',
    'How I Met Your Mother',
    'Ted Mosby tells his children the long story of how he met their mother, with every friendship, heartbreak, and bad idea along the way.',
    null,
    2005,
    22,
    'TV-14',
    8.3,
    765,
    array['comedy','romance'],
    'en',
    array['Carter Bays','Craig Thomas'],
    array['Josh Radnor','Jason Segel','Cobie Smulders','Neil Patrick Harris']
  )
on conflict (tmdb_id, content_type) do update
  set title = excluded.title,
      original_title = excluded.original_title,
      synopsis = excluded.synopsis,
      runtime_minutes = excluded.runtime_minutes,
      content_rating = excluded.content_rating,
      imdb_rating = excluded.imdb_rating,
      popularity = greatest(public.titles.popularity, excluded.popularity),
      genres = excluded.genres,
      language = excluded.language,
      creators = excluded.creators,
      "cast" = excluded."cast",
      updated_at = now();

insert into public.title_availability (title_id, service_id, region, offer_type)
select t.id, 'hulu', 'US', 'subscription'
from public.titles t
where t.tmdb_id = 1100 and t.content_type = 'tv'
union all
select t.id, 'prime_video', 'US', 'rent'
from public.titles t
where t.tmdb_id = 1100 and t.content_type = 'tv'
on conflict do nothing;
