import type { Title, TitleAvailability } from '@flixy/shared';
import { TitleSchema } from '@flixy/shared';
import Constants from 'expo-constants';

// Extra config from app.config.ts
const extra = (Constants.expoConfig?.extra ?? {}) as {
  tmdbApiKey?: string;
  tmdbReadAccessToken?: string;
};

const TMDB_API_KEY = extra.tmdbApiKey || '';
const TMDB_READ_ACCESS_TOKEN = extra.tmdbReadAccessToken || '';

const BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_REQUEST_TIMEOUT_MS = 12_000;

// TMDB returns localized titles/overviews when given a `language` param. We keep
// it in sync with the app language so movies AND series show up translated.
const TMDB_LANGUAGE_MAP: Record<string, string> = {
  en: 'en-US',
  tr: 'tr-TR',
  bg: 'bg-BG',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  'pt-BR': 'pt-BR',
};

let tmdbLanguage = 'en-US';

/** Returns the current TMDB language tag (e.g. "tr-TR"). */
export function getTmdbLanguage(): string {
  return tmdbLanguage;
}

/** Sets the TMDB content language from an app locale code (e.g. "tr"). */
export function setTmdbLanguage(appLocale: string | null | undefined): void {
  if (!appLocale) return;
  const base = appLocale.split('-')[0] ?? appLocale;
  tmdbLanguage = TMDB_LANGUAGE_MAP[appLocale] ?? TMDB_LANGUAGE_MAP[base] ?? 'en-US';
}

// Minimal TMDB response shapes. The final Title output is validated by
// TitleSchema.parse, so these only describe what the mapping reads.
type TmdbVideo = { type: string; site: string; key: string };
type TmdbProviderEntry = { provider_id: number };
type TmdbProvidersResult = Record<
  string,
  {
    flatrate?: TmdbProviderEntry[];
    rent?: TmdbProviderEntry[];
    buy?: TmdbProviderEntry[];
    free?: TmdbProviderEntry[];
    link?: string;
    [key: string]: TmdbProviderEntry[] | string | undefined;
  }
>;
type TmdbTitle = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number }[];
  genre_ids?: number[];
  credits?: { crew?: { job?: string; name: string }[]; cast?: { name: string }[] };
  created_by?: { name: string }[];
  videos?: { results: TmdbVideo[] };
  'watch/providers'?: { results?: TmdbProvidersResult };
  vote_average?: number;
  popularity?: number;
  original_language?: string;
  tagline?: string;
  media_type?: string;
};
type TmdbListResponse = { results?: TmdbTitle[] };

// Mappings for genres
export const TMDB_MOVIE_GENRES: Record<number, string> = {
  28: 'action',
  12: 'adventure',
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'family',
  14: 'fantasy',
  36: 'history',
  27: 'horror',
  9648: 'mystery',
  10749: 'romance',
  878: 'sci_fi',
  53: 'thriller',
};

export const TMDB_TV_GENRES: Record<number, string> = {
  10759: 'action', // Action & Adventure
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'family',
  10765: 'sci_fi', // Sci-Fi & Fantasy
  9648: 'mystery',
};

export const FLIXY_TO_TMDB_MOVIE_GENRE: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  mystery: 9648,
  romance: 10749,
  sci_fi: 878,
  thriller: 53,
};

export const FLIXY_TO_TMDB_TV_GENRE: Record<string, number> = {
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 10765,
  sci_fi: 10765,
  mystery: 9648,
};

// Provider mappings
export const FLIXY_TO_TMDB_PROVIDER: Record<string, number> = {
  netflix: 8,
  prime_video: 9,
  disney_plus: 337,
  hbo_max: 1899,
  apple_tv: 350,
  hulu: 15,
  mubi: 11,
};

export const TMDB_TO_FLIXY_PROVIDER: Record<number, string> = {
  8: 'netflix',
  9: 'prime_video',
  337: 'disney_plus',
  1899: 'hbo_max',
  384: 'hbo_max',
  350: 'apple_tv',
  2: 'apple_tv',
  15: 'hulu',
  11: 'mubi',
};

/**
 * Deterministically maps TMDB integer IDs & content types to a valid UUID format.
 * - 'movie' maps to variant 'a000'
 * - 'tv' maps to variant 'b000'
 */
export function tmdbIdToUuid(tmdbId: number, type: 'movie' | 'tv'): string {
  const prefix = type === 'movie' ? 'a000' : 'b000';
  return `00000000-0000-4000-${prefix}-${String(tmdbId).padStart(12, '0')}`;
}

/**
 * Reverses a deterministic UUID back to TMDB ID and content type.
 */
export function uuidToTmdbId(uuid: string): { tmdbId: number; type: 'movie' | 'tv' } | null {
  const match = uuid.match(/^00000000-0000-4000-(a000|b000)-(\d{12})$/);
  if (!match || !match[2]) return null;
  return {
    type: match[1] === 'a000' ? 'movie' : 'tv',
    tmdbId: Number.parseInt(match[2], 10),
  };
}

// In-memory request deduplication cache to prevent concurrent N+1 or burst request loops
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Helper to call the TMDB API
 */
async function callTmdb(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not configured.');
  }
  const queryParams = new URLSearchParams({
    language: tmdbLanguage,
    ...params,
    api_key: TMDB_API_KEY,
  });
  const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;

  const cached = pendingRequests.get(url);
  if (cached) return cached;

  const promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TMDB_REQUEST_TIMEOUT_MS);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (TMDB_READ_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${TMDB_READ_ACCESS_TOKEN}`;
    }

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) {
        const error = new Error(
          `TMDB API call failed: ${response.status} ${response.statusText}`,
        ) as Error & { status: number };
        error.status = response.status;
        throw error;
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  })();

  pendingRequests.set(url, promise);
  try {
    return await promise;
  } finally {
    pendingRequests.delete(url);
  }
}

/**
 * Maps TMDB API provider results to Flixy TitleAvailability
 */
function mapTmdbProvidersToAvailability(
  results: TmdbProvidersResult | undefined,
  filterRegion?: string,
): TitleAvailability[] {
  if (!results) return [];
  const availability: TitleAvailability[] = [];
  const regions = filterRegion ? [filterRegion.toUpperCase()] : Object.keys(results);

  for (const region of regions) {
    const data = results[region];
    if (!data) continue;

    const categories = [
      { key: 'flatrate', type: 'subscription' as const },
      { key: 'rent', type: 'rent' as const },
      { key: 'buy', type: 'buy' as const },
      { key: 'free', type: 'free' as const },
    ];

    for (const { key, type } of categories) {
      const providers = data[key];
      if (Array.isArray(providers)) {
        for (const provider of providers) {
          const serviceId = TMDB_TO_FLIXY_PROVIDER[provider.provider_id];
          if (serviceId) {
            availability.push({
              serviceId,
              region: region.toUpperCase(),
              offerType: type,
              deepLink: data.link || null,
              observedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }
  return availability;
}

/**
 * Translates a TMDB API details response to the Flixy Title object
 */
export function mapTmdbToTitle(
  tmdbData: TmdbTitle,
  type: 'movie' | 'tv',
  providersResult?: TmdbProvidersResult,
): Title {
  const id = tmdbIdToUuid(tmdbData.id, type);
  const releaseDate = type === 'movie' ? tmdbData.release_date : tmdbData.first_air_date;
  const yearStr = releaseDate?.split('-')[0];
  const releaseYear = yearStr ? Number.parseInt(yearStr, 10) : null;
  const runtime = type === 'movie' ? tmdbData.runtime : tmdbData.episode_run_time?.[0] || null;

  // Parse genres
  const genres: string[] = [];
  if (Array.isArray(tmdbData.genres)) {
    for (const g of tmdbData.genres) {
      const mapped = type === 'movie' ? TMDB_MOVIE_GENRES[g.id] : TMDB_TV_GENRES[g.id];
      if (mapped) genres.push(mapped);
    }
  } else if (Array.isArray(tmdbData.genre_ids)) {
    for (const gid of tmdbData.genre_ids) {
      const mapped = type === 'movie' ? TMDB_MOVIE_GENRES[gid] : TMDB_TV_GENRES[gid];
      if (mapped) genres.push(mapped);
    }
  }

  // Parse crew & cast from credits
  const directors: string[] = [];
  const creators: string[] = [];
  const cast: string[] = [];

  if (tmdbData.credits) {
    if (Array.isArray(tmdbData.credits.crew)) {
      for (const member of tmdbData.credits.crew) {
        if (member.job === 'Director') {
          directors.push(member.name);
        }
      }
    }
    if (Array.isArray(tmdbData.credits.cast)) {
      for (const actor of tmdbData.credits.cast.slice(0, 10)) {
        cast.push(actor.name);
      }
    }
  }

  if (type === 'tv' && Array.isArray(tmdbData.created_by)) {
    for (const creator of tmdbData.created_by) {
      creators.push(creator.name);
    }
  }

  // Find trailer key
  let trailerKey: string | null = null;
  if (tmdbData.videos && Array.isArray(tmdbData.videos.results)) {
    const trailer = tmdbData.videos.results.find(
      (v: TmdbVideo) => v.type === 'Trailer' && v.site === 'YouTube',
    );
    if (trailer) {
      trailerKey = trailer.key;
    }
  }

  // Get availability
  const availability = mapTmdbProvidersToAvailability(
    providersResult || tmdbData['watch/providers']?.results,
  );

  return TitleSchema.parse({
    id,
    tmdbId: tmdbData.id,
    kind: type,
    title: tmdbData.title || tmdbData.name || '',
    originalTitle: tmdbData.original_title || tmdbData.original_name || null,
    overview: tmdbData.overview || null,
    posterUrl: tmdbData.poster_path
      ? `https://image.tmdb.org/t/p/w780${tmdbData.poster_path}`
      : null,
    backdropUrl: tmdbData.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}`
      : null,
    trailerKey,
    releaseYear,
    runtimeMinutes: runtime || null,
    contentRating: null,
    imdbRating: tmdbData.vote_average || null,
    criticScore: null,
    popularity: tmdbData.popularity || 0,
    genres,
    numberOfSeasons: type === 'tv' ? (tmdbData.number_of_seasons ?? null) : null,
    numberOfEpisodes: type === 'tv' ? (tmdbData.number_of_episodes ?? null) : null,
    language: tmdbData.original_language || null,
    tagline: tmdbData.tagline || null,
    directors,
    creators,
    cast,
    availability,
  });
}

/**
 * Fetches a single title's details by TMDB ID
 */
export async function fetchTmdbTitle(tmdbId: number, type: 'movie' | 'tv'): Promise<Title> {
  const data = await callTmdb(`/${type}/${tmdbId}`, {
    append_to_response: 'credits,videos,watch/providers',
  });
  return mapTmdbToTitle(data as TmdbTitle, type);
}

/**
 * Fetches multiple titles by UUIDs (e.g. for watchlist load)
 */
export async function fetchTmdbTitlesByIds(uuids: string[]): Promise<Title[]> {
  const promises = uuids.map(async (uuid) => {
    const tmdbInfo = uuidToTmdbId(uuid);
    if (!tmdbInfo) return null;
    try {
      return await fetchTmdbTitle(tmdbInfo.tmdbId, tmdbInfo.type);
    } catch (e) {
      console.error(`Failed to fetch TMDB details for ${uuid}`, e);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((t): t is Title => t !== null);
}

export type TmdbDiscoverFilter = {
  region?: string;
  serviceIds?: string[];
  genres?: string[];
  kinds?: ('movie' | 'tv')[];
  minYear?: number;
  maxYear?: number;
  /** Origin country ISO-3166 alpha-2 filter (e.g. "TR", "US", "KR"). */
  originCountry?: string;
  /** Vibe-derived genre OR-list merged into `with_genres`. */
  vibeGenres?: string[];
  limit?: number;
  page?: number;
};

// ISO-3166 alpha-2 -> ISO-639-1 used to drive TMDB `with_original_language`.
const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  US: 'en',
  GB: 'en',
  TR: 'tr',
  KR: 'ko',
  JP: 'ja',
  IN: 'hi',
  DE: 'de',
  ES: 'es',
  FR: 'fr',
  IT: 'it',
  BR: 'pt',
  MX: 'es',
};

/**
 * Queries TMDB discover endpoint based on filters.
 * No longer executes N+1 calls to fetch providers; maps immediately.
 */
export async function discoverTmdbTitles(filter: TmdbDiscoverFilter): Promise<Title[]> {
  const kinds = filter.kinds && filter.kinds.length > 0 ? filter.kinds : (['movie', 'tv'] as const);
  const results: Title[] = [];

  const serviceProviders = filter.serviceIds
    ?.map((id) => FLIXY_TO_TMDB_PROVIDER[id])
    .filter(Boolean);

  const region = filter.region || 'US';
  const originCountry = filter.originCountry?.toUpperCase();
  const originalLanguage = originCountry ? COUNTRY_LANGUAGE_MAP[originCountry] : undefined;

  // Merge explicit genres + vibe-derived genres into a single OR-list so the
  // user can stack "preferred genres" and "vibes" without one cancelling the
  // other out.
  const mergedGenres = Array.from(
    new Set([...(filter.genres ?? []), ...(filter.vibeGenres ?? [])]),
  );

  const fetchPromises = kinds.map(async (kind) => {
    const params: Record<string, string> = {
      sort_by: 'popularity.desc',
      watch_region: region,
    };

    if (filter.page && filter.page > 1) {
      params.page = String(filter.page);
    }

    if (serviceProviders && serviceProviders.length > 0) {
      params.with_watch_providers = serviceProviders.join('|');
    }

    if (mergedGenres.length > 0) {
      const genreIds = mergedGenres
        .map((g) => (kind === 'movie' ? FLIXY_TO_TMDB_MOVIE_GENRE[g] : FLIXY_TO_TMDB_TV_GENRE[g]))
        .filter(Boolean);
      if (genreIds.length > 0) {
        // OR-match on the selected genres. We deliberately do NOT add
        // `without_genres` here: excluding every non-selected genre forced an
        // exact-subset match, which starved the deck and made filtering feel
        // broken (most titles carry a secondary genre the user didn't pick).
        params.with_genres = genreIds.join('|');
      }
    }

    // Origin country / original language filter. TMDB's discover endpoints
    // accept `with_origin_country` (movie + tv) and `with_original_language`.
    // We use both to be robust across endpoints that may not return origin_country.
    if (originCountry) {
      params.with_origin_country = originCountry;
    }
    if (originalLanguage) {
      params.with_original_language = originalLanguage;
    }

    if (filter.minYear) {
      const yearKey = kind === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
      params[yearKey] = `${filter.minYear}-01-01`;
    }
    if (filter.maxYear) {
      const yearKey = kind === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte';
      params[yearKey] = `${filter.maxYear}-12-31`;
    }

    try {
      const data = await callTmdb(`/discover/${kind}`, params);
      const items = ((data as TmdbListResponse).results || []).slice(0, filter.limit || 30);

      // Map immediately without loading individual providers to prevent N+1 queries.
      // Optimistically inject the queried service provider if filtered.
      return items.map((item: TmdbTitle) => {
        const title = mapTmdbToTitle(item, kind);
        if (filter.serviceIds && filter.serviceIds.length > 0) {
          title.availability = filter.serviceIds.map((srvId) => ({
            serviceId: srvId,
            region: region.toUpperCase(),
            offerType: 'subscription' as const,
            deepLink: null,
            observedAt: new Date().toISOString(),
          }));
        }
        return title;
      });
    } catch (e) {
      console.error(`Failed to discover TMDB titles for ${kind}`, e);
      return [];
    }
  });

  const outputs = await Promise.all(fetchPromises);
  for (const list of outputs) {
    results.push(...list);
  }

  // Keep each requested kind's page. Sorting then globally slicing this merged
  // array made high-popularity TV results evict every movie before the deck
  // composer could apply its movie/series balance policy.
  return results.sort((a, b) => b.popularity - a.popularity);
}

/**
 * Search multi-search endpoint. Maps immediately without N+1 providers fetches.
 */
export async function searchTmdbTitles(query: string): Promise<Title[]> {
  try {
    const data = await callTmdb('/search/multi', { query });
    const results = (data as TmdbListResponse).results || [];

    const validItems = results.filter(
      (item: TmdbTitle) => item.media_type === 'movie' || item.media_type === 'tv',
    );

    return validItems
      .slice(0, 20)
      .map((item: TmdbTitle) => {
        return mapTmdbToTitle(item, item.media_type as 'movie' | 'tv');
      })
      .sort((a: Title, b: Title) => b.popularity - a.popularity);
  } catch (e) {
    console.error('TMDB Search failed', e);
    return [];
  }
}
