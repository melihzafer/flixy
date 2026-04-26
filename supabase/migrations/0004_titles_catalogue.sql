-- 0004_titles_catalogue.sql
-- Content catalogue (FSD section 3.4). Stores the canonical title records the
-- mobile client reads. TMDB ingestion via Trigger.dev populates this table;
-- for MVP we ship a small dev seed so the swipe deck is functional pre-ingest.

create table if not exists public.titles (
  id              uuid primary key default uuid_generate_v4(),
  tmdb_id         integer not null,
  content_type    text not null check (content_type in ('movie','tv')),
  title           text not null,
  original_title  text,
  synopsis        text,
  poster_url      text,
  backdrop_url    text,
  trailer_key     text,            -- YouTube key
  release_year    integer,
  runtime_minutes integer,
  imdb_rating     numeric(3,1),
  popularity      numeric not null default 0,
  genres          text[] not null default '{}',
  language        text,
  is_adult        boolean not null default false,
  is_hidden       boolean not null default false,  -- admin override
  ingested_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tmdb_id, content_type)
);

create index if not exists titles_popularity_idx on public.titles (popularity desc);
create index if not exists titles_genres_gin on public.titles using gin (genres);
create index if not exists titles_release_year_idx on public.titles (release_year desc);

drop trigger if exists titles_set_updated_at on public.titles;
create trigger titles_set_updated_at
  before update on public.titles
  for each row execute function public.tg_set_updated_at();

-- Region-aware availability: which services carry which titles where.
create table if not exists public.title_availability (
  title_id    uuid not null references public.titles(id) on delete cascade,
  service_id  text not null references public.streaming_services(id) on delete cascade,
  region      char(2) not null check (region ~ '^[A-Z]{2}$'),
  offer_type  text not null check (offer_type in ('subscription','rent','buy','free')),
  deep_link   text,
  observed_at timestamptz not null default now(),
  primary key (title_id, service_id, region, offer_type)
);

create index if not exists title_availability_region_idx
  on public.title_availability (region, service_id);
create index if not exists title_availability_observed_idx
  on public.title_availability (observed_at desc);

-- ==========================================================================
-- Public read: catalogue is non-sensitive. Writes are server-only (service
-- role from Trigger.dev jobs).
-- ==========================================================================
alter table public.titles enable row level security;
alter table public.title_availability enable row level security;

drop policy if exists "titles: public read" on public.titles;
create policy "titles: public read"
  on public.titles for select
  using (is_hidden = false and is_adult = false);

drop policy if exists "title_availability: public read" on public.title_availability;
create policy "title_availability: public read"
  on public.title_availability for select
  using (true);

-- ==========================================================================
-- Seed: 20 dev titles + a smattering of US/TR availability records so the
-- deck is non-empty before TMDB ingestion lands. Real ingest replaces these.
-- ==========================================================================
insert into public.titles
  (tmdb_id, content_type, title, synopsis, poster_url, release_year, runtime_minutes, imdb_rating, popularity, genres, language)
values
  (155,    'movie', 'The Dark Knight',          'A vigilante faces a chaotic criminal mastermind.', 'https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg', 2008, 152, 9.0, 980, array['action','crime','thriller'], 'en'),
  (27205,  'movie', 'Inception',                'A thief steals secrets through dream-sharing tech.', 'https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', 2010, 148, 8.8, 950, array['action','sci_fi','thriller'], 'en'),
  (157336, 'movie', 'Interstellar',             'Explorers travel through a wormhole in space.',     'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', 2014, 169, 8.7, 920, array['adventure','drama','sci_fi'], 'en'),
  (550,    'movie', 'Fight Club',               'An insomniac office worker forms an underground fight club.', 'https://image.tmdb.org/t/p/w780/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', 1999, 139, 8.8, 870, array['drama','thriller'], 'en'),
  (680,    'movie', 'Pulp Fiction',             'The lives of two mob hitmen, a boxer, a gangster intertwine.', 'https://image.tmdb.org/t/p/w780/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', 1994, 154, 8.9, 850, array['crime','drama'], 'en'),
  (13,     'movie', 'Forrest Gump',             'Decades of US history through a slow-witted Alabama man.',  'https://image.tmdb.org/t/p/w780/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', 1994, 142, 8.8, 800, array['comedy','drama','romance'], 'en'),
  (424,    'movie', 'Schindlers List',          'A businessman saves Jewish refugees during WWII.',          'https://image.tmdb.org/t/p/w780/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg', 1993, 195, 8.9, 780, array['drama','history'], 'en'),
  (12,     'movie', 'Finding Nemo',             'A clownfish searches for his abducted son.',                'https://image.tmdb.org/t/p/w780/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg', 2003, 100, 8.2, 770, array['animation','adventure','family'], 'en'),
  (122,    'movie', 'The Lord of the Rings: The Return of the King', 'Frodo and Sam reach Mordor.',         'https://image.tmdb.org/t/p/w780/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg', 2003, 201, 8.9, 820, array['adventure','fantasy'], 'en'),
  (603,    'movie', 'The Matrix',               'A hacker discovers the nature of reality.',                  'https://image.tmdb.org/t/p/w780/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', 1999, 136, 8.7, 880, array['action','sci_fi'], 'en'),
  (1399,   'tv',    'Game of Thrones',          'Noble families vie for the Iron Throne.',                    'https://image.tmdb.org/t/p/w780/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg', 2011, 60,  9.2, 990, array['drama','fantasy','adventure'], 'en'),
  (1396,   'tv',    'Breaking Bad',             'A chemistry teacher turns to making meth.',                  'https://image.tmdb.org/t/p/w780/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',  2008, 49,  9.5, 970, array['crime','drama','thriller'], 'en'),
  (1668,   'tv',    'Friends',                  'Six twenty-somethings in Manhattan.',                        'https://image.tmdb.org/t/p/w780/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg',  1994, 22,  8.9, 760, array['comedy','romance'], 'en'),
  (66732,  'tv',    'Stranger Things',          'Kids in 1980s Indiana face supernatural mysteries.',         'https://image.tmdb.org/t/p/w780/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', 2016, 51,  8.7, 940, array['drama','fantasy','sci_fi'], 'en'),
  (60059,  'tv',    'Better Call Saul',         'A small-time lawyer becomes Saul Goodman.',                  'https://image.tmdb.org/t/p/w780/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg', 2015, 46,  8.9, 700, array['crime','drama'], 'en'),
  (1402,   'tv',    'The Walking Dead',         'Survivors navigate a post-apocalyptic world overrun by zombies.', 'https://image.tmdb.org/t/p/w780/n4znNs4Yz4QO7M1yUzRsNTSHSqZ.jpg', 2010, 44, 8.1, 720, array['drama','horror','thriller'], 'en'),
  (94997,  'tv',    'House of the Dragon',      'The Targaryen civil war 200 years before GoT.',              'https://image.tmdb.org/t/p/w780/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg', 2022, 60, 8.5, 930, array['drama','fantasy'], 'en'),
  (60625,  'tv',    'Rick and Morty',           'A scientist and his grandson go on intergalactic adventures.',   'https://image.tmdb.org/t/p/w780/gdIrmf2DdY5mgN6ycVP0XlzKzbE.jpg', 2013, 22, 9.1, 690, array['animation','comedy','sci_fi'], 'en'),
  (76479,  'tv',    'The Boys',                 'Vigilantes go after corrupt superheroes.',                   'https://image.tmdb.org/t/p/w780/stTEycfG9928HYGEISBFaG1ngjM.jpg', 2019, 60, 8.7, 880, array['action','crime','sci_fi'], 'en'),
  (84958,  'tv',    'Loki',                     'The mischievous trickster god takes on the TVA.',            'https://image.tmdb.org/t/p/w780/voHUmluYmKyleFkTu3lOXQG702u.jpg', 2021, 50, 8.2, 650, array['action','adventure','fantasy'], 'en')
on conflict (tmdb_id, content_type) do nothing;

-- A handful of availability rows so the deck filter can prove itself.
insert into public.title_availability (title_id, service_id, region, offer_type)
select t.id, 'netflix', 'US', 'subscription' from public.titles t where t.tmdb_id in (550, 680, 60625, 76479, 66732)
union all
select t.id, 'prime_video', 'US', 'subscription' from public.titles t where t.tmdb_id in (76479, 13, 12)
union all
select t.id, 'hbo_max', 'US', 'subscription' from public.titles t where t.tmdb_id in (1399, 1396, 60059, 94997, 155)
union all
select t.id, 'disney_plus', 'US', 'subscription' from public.titles t where t.tmdb_id in (12, 84958)
union all
select t.id, 'netflix', 'TR', 'subscription' from public.titles t where t.tmdb_id in (550, 27205, 66732, 60625)
on conflict do nothing;
