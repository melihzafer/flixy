// Trakt trending sync. Pulls /movies/trending and /shows/trending, then
// writes the watcher counts back to public.titles.trakt_watchers (and
// trakt_synced_at) for any title we already ingested from TMDB. This is
// purely a *signal*: it does not insert new titles — only annotates ones
// the TMDB pipeline already produced. Deck ranking blends it with TMDB
// popularity later.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { TraktClient, TraktTrendingItem } from './traktClient';

export type SyncTraktOptions = {
  supabase: SupabaseClient;
  trakt: TraktClient;
  movieLimit?: number;
  showLimit?: number;
  dryRun?: boolean;
};

export type SyncTraktSummary = {
  dryRun: boolean;
  fetchedMovies: number;
  fetchedShows: number;
  matchedCount: number;
  updatedCount: number;
  errorCount: number;
};

type TitleMatch = { id: string; tmdb_id: number; content_type: 'movie' | 'tv' };

async function lookupMatches(
  supabase: SupabaseClient,
  items: TraktTrendingItem[],
): Promise<Map<string, TitleMatch>> {
  const movieIds = items
    .filter(
      (i): i is TraktTrendingItem & { tmdbId: number } =>
        i.contentType === 'movie' && i.tmdbId !== null,
    )
    .map((i) => i.tmdbId);
  const tvIds = items
    .filter(
      (i): i is TraktTrendingItem & { tmdbId: number } =>
        i.contentType === 'tv' && i.tmdbId !== null,
    )
    .map((i) => i.tmdbId);
  const matches = new Map<string, TitleMatch>();

  for (const [contentType, ids] of [
    ['movie', movieIds],
    ['tv', tvIds],
  ] as const) {
    if (ids.length === 0) continue;
    const { data, error } = await supabase
      .from('titles')
      .select('id, tmdb_id, content_type')
      .eq('content_type', contentType)
      .in('tmdb_id', ids);
    if (error) throw new Error(`Trakt match lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      const match = row as TitleMatch;
      matches.set(`${match.content_type}:${match.tmdb_id}`, match);
    }
  }
  return matches;
}

export async function syncTraktTrending(options: SyncTraktOptions): Promise<SyncTraktSummary> {
  const dryRun = options.dryRun ?? false;
  const movieLimit = options.movieLimit ?? 50;
  const showLimit = options.showLimit ?? 50;

  const [movies, shows] = await Promise.all([
    options.trakt.listTrendingMovies(movieLimit),
    options.trakt.listTrendingShows(showLimit),
  ]);
  const items = [...movies, ...shows];

  const matches = await lookupMatches(options.supabase, items);
  const now = new Date().toISOString();
  let updated = 0;
  let errors = 0;

  for (const item of items) {
    if (item.tmdbId === null) continue;
    const match = matches.get(`${item.contentType}:${item.tmdbId}`);
    if (!match) continue;
    if (dryRun) {
      updated += 1;
      continue;
    }
    const { error } = await options.supabase
      .from('titles')
      .update({
        trakt_watchers: item.watchers,
        trakt_synced_at: now,
      })
      .eq('id', match.id);
    if (error) {
      errors += 1;
    } else {
      updated += 1;
    }
  }

  return {
    dryRun,
    fetchedMovies: movies.length,
    fetchedShows: shows.length,
    matchedCount: matches.size,
    updatedCount: updated,
    errorCount: errors,
  };
}
