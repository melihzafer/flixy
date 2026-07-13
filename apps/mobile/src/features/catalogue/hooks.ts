import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { type Title, TitleAvailabilitySchema, TitleSchema } from '@flixy/shared';

import { FALLBACK_TITLES, normalizeGenreId, normalizeServiceId } from '../../lib/fallbackCatalogue';
import { logger } from '../../lib/logger';
import {
  discoverTmdbTitles,
  fetchTmdbTitle,
  fetchTmdbTitlesByIds,
  getTmdbLanguage,
  uuidToTmdbId,
} from '../../lib/tmdb';

export type CatalogueFallbackReason =
  | 'supabase_unconfigured'
  | 'query_failed'
  | 'live_empty'
  | 'service_empty'
  | 'filtered_empty'
  | 'exhausted'
  | 'unknown';

export type CatalogueDiagnostics = {
  liveCandidateCount: number | null;
  candidateCount: number;
  afterServiceFilterCount: number | null;
  finalCardsCount?: number;
  fallbackReason: CatalogueFallbackReason | null;
  isFallback: boolean;
  isNarrow: boolean;
  emptyReason: CatalogueFallbackReason | null;
};

export type TitleQueryResult = {
  titles: Title[];
  diagnostics: CatalogueDiagnostics;
};

type TitlesQueryOptions = {
  enabled?: boolean;
};

export const TITLE_QUERY_RESULT_SHAPE_VERSION = 2;
const TITLE_QUERY_CACHE_VERSION_KEY = `shape-v${TITLE_QUERY_RESULT_SHAPE_VERSION}`;

function fallbackTitleById(id: string): Title | null {
  return FALLBACK_TITLES.find((t) => t.id === id) ?? null;
}

function makeDiagnostics(input: {
  titles: Title[];
  liveCandidateCount?: number | null;
  afterServiceFilterCount?: number | null;
  fallbackReason?: CatalogueFallbackReason | null;
  isFallback?: boolean;
  limit?: number;
}): CatalogueDiagnostics {
  const candidateCount = input.titles.length;
  const emptyReason = candidateCount === 0 ? (input.fallbackReason ?? 'filtered_empty') : null;
  return {
    liveCandidateCount: input.liveCandidateCount ?? null,
    candidateCount,
    afterServiceFilterCount: input.afterServiceFilterCount ?? null,
    fallbackReason: input.fallbackReason ?? null,
    isFallback: input.isFallback ?? false,
    isNarrow: candidateCount < (input.limit ?? 60),
    emptyReason,
  };
}

function withDiagnostics(
  titles: Title[],
  filter: TitleQueryFilter,
  diagnostics: Omit<CatalogueDiagnostics, 'candidateCount' | 'emptyReason' | 'isNarrow'>,
): TitleQueryResult {
  return {
    titles,
    diagnostics: makeDiagnostics({
      titles,
      liveCandidateCount: diagnostics.liveCandidateCount,
      afterServiceFilterCount: diagnostics.afterServiceFilterCount,
      fallbackReason: diagnostics.fallbackReason,
      isFallback: diagnostics.isFallback,
      limit: filter.limit,
    }),
  };
}

function applyFallbackFilter(filter: TitleQueryFilter): Title[] {
  const serviceIds = new Set((filter.serviceIds ?? []).map(normalizeServiceId));
  const genres = new Set((filter.genres ?? []).map(normalizeGenreId));
  const vibeGenres = new Set((filter.vibeGenres ?? []).map(normalizeGenreId));
  const effectiveGenres = new Set<string>([...genres, ...vibeGenres]);
  // Country filter uses the title `language` field as a coarse proxy: TMDB
  // populates `original_language` (e.g. "tr", "en", "ko"), which is the closest
  // fallback catalog has to origin country.
  const countryLang = filter.originCountry
    ? COUNTRY_LANGUAGE_MAP[filter.originCountry.toUpperCase()]
    : null;

  return FALLBACK_TITLES.map((title) => ({
    ...title,
    availability: filter.region
      ? title.availability.filter((a) => a.region === filter.region)
      : title.availability,
  }))
    .filter((title) => {
      if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(title.kind)) {
        return false;
      }
      if (effectiveGenres.size > 0) {
        const hasMatch = title.genres.some((genre) => effectiveGenres.has(normalizeGenreId(genre)));
        if (!hasMatch) return false;
      }
      if (
        filter.minYear != null &&
        (title.releaseYear == null || title.releaseYear < filter.minYear)
      ) {
        return false;
      }
      if (
        filter.maxYear != null &&
        (title.releaseYear == null || title.releaseYear > filter.maxYear)
      ) {
        return false;
      }
      if (countryLang && !(title.language ?? '').toLowerCase().startsWith(countryLang)) {
        return false;
      }
      if (filter.region && title.availability.length === 0) {
        return false;
      }
      if (
        serviceIds.size > 0 &&
        !title.availability.some((a) => serviceIds.has(normalizeServiceId(a.serviceId)))
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, filter.limit ?? 60);
}

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

export function useTitle(id: string | null | undefined) {
  return useQuery({
    queryKey: ['title', TITLE_QUERY_CACHE_VERSION_KEY, getTmdbLanguage(), id],
    enabled: !!id,
    // Only reuse previous data across a language change of the SAME title
    // (key index 3 is the id). Blanket keepPreviousData would briefly render
    // the previously viewed movie's poster/details when opening a different
    // title, because placeholder data reports `success` and skips the loading
    // state.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[3] === id ? previousData : undefined,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    queryFn: async () => {
      if (!id) return null;
      const tmdbInfo = uuidToTmdbId(id);
      if (!tmdbInfo) {
        return fallbackTitleById(id);
      }
      try {
        return await fetchTmdbTitle(tmdbInfo.tmdbId, tmdbInfo.type);
      } catch (e) {
        logger.warn('TMDB fetch title failed, trying fallback', { id, error: String(e) });
        const fallback = fallbackTitleById(id);
        if (fallback) return fallback;
        throw e;
      }
    },
  });
}

export function useTitlesByIds(ids: string[]) {
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: [
      'titles',
      'byIds',
      TITLE_QUERY_CACHE_VERSION_KEY,
      getTmdbLanguage(),
      sorted.join(','),
    ],
    enabled: sorted.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 60 * 12, // 12 hours
    queryFn: async () => {
      try {
        const liveTitles = await fetchTmdbTitlesByIds(sorted);
        const byId = new Map(liveTitles.map((title) => [title.id, title]));
        for (const id of sorted) {
          if (!byId.has(id)) {
            const fallback = fallbackTitleById(id);
            if (fallback) byId.set(id, fallback);
          }
        }
        return sorted.map((id) => byId.get(id)).filter((t): t is Title => t != null);
      } catch (e) {
        logger.warn('TMDB fetch titles by ids failed, trying fallbacks', {
          ids: sorted.length,
          error: String(e),
        });
        return sorted.map(fallbackTitleById).filter((t): t is Title => t !== null);
      }
    },
  });
}

export type TitleQueryFilter = {
  region?: string;
  serviceIds?: string[];
  genres?: string[];
  kinds?: ('movie' | 'tv')[];
  minYear?: number;
  maxYear?: number;
  /** Origin country ISO-3166 alpha-2 filter (e.g. "TR", "US", "KR"). */
  originCountry?: string;
  /**
   * Vibe genres: a flat OR-list of genres derived from selected vibe presets.
   * Merged into the TMDB `with_genres` OR-match alongside user genre filters.
   */
  vibeGenres?: string[];
  limit?: number;
  page?: number;
};

export function useTitlesQuery(filter: TitleQueryFilter, options: TitlesQueryOptions = {}) {
  const key = JSON.stringify(filter);
  return useQuery({
    queryKey: [
      'titles',
      'query',
      `shape-v${TITLE_QUERY_RESULT_SHAPE_VERSION}`,
      getTmdbLanguage(),
      key,
    ],
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 60, // 1 hour
    queryFn: async () => {
      try {
        const titles = await discoverTmdbTitles({
          region: filter.region,
          serviceIds: filter.serviceIds,
          genres: filter.genres,
          kinds: filter.kinds,
          minYear: filter.minYear,
          maxYear: filter.maxYear,
          originCountry: filter.originCountry,
          vibeGenres: filter.vibeGenres,
          limit: filter.limit,
          page: filter.page,
        });

        if (titles.length === 0) {
          const fallbackTitles = applyFallbackFilter(filter);
          return withDiagnostics(fallbackTitles, filter, {
            liveCandidateCount: 0,
            afterServiceFilterCount: null,
            fallbackReason: 'live_empty',
            isFallback: true,
          });
        }

        return withDiagnostics(titles, filter, {
          liveCandidateCount: titles.length,
          afterServiceFilterCount: titles.length,
          fallbackReason: null,
          isFallback: false,
        });
      } catch (e) {
        logger.warn('TMDB discover failed, trying fallback', { filter: key, error: String(e) });
        const fallbackTitles = applyFallbackFilter(filter);
        return withDiagnostics(fallbackTitles, filter, {
          liveCandidateCount: null,
          afterServiceFilterCount: null,
          fallbackReason: 'query_failed',
          isFallback: true,
        });
      }
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function availabilityArray(value: unknown): Title['availability'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => TitleAvailabilitySchema.safeParse(item))
    .filter(
      (result): result is { success: true; data: Title['availability'][number] } => result.success,
    )
    .map((result) => result.data);
}

function titleFromCache(value: unknown): Title | null {
  if (!isRecord(value)) return null;
  const parsed = TitleSchema.safeParse({
    ...value,
    genres: stringArray(value.genres),
    availability: availabilityArray(value.availability),
  });
  return parsed.success ? parsed.data : null;
}

function titleArrayFromCache(value: unknown): Title[] {
  if (!Array.isArray(value)) return [];
  return value.map(titleFromCache).filter((title): title is Title => title !== null);
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fallbackReason(value: unknown): CatalogueFallbackReason | null {
  if (
    value === 'supabase_unconfigured' ||
    value === 'query_failed' ||
    value === 'live_empty' ||
    value === 'service_empty' ||
    value === 'filtered_empty' ||
    value === 'exhausted' ||
    value === 'unknown'
  ) {
    return value;
  }
  return null;
}

function normalizedDiagnostics(
  value: unknown,
  titles: Title[],
  filter: TitleQueryFilter,
): CatalogueDiagnostics {
  if (!isRecord(value)) {
    return makeDiagnostics({ titles, limit: filter.limit });
  }
  const diagnostics = makeDiagnostics({
    titles,
    liveCandidateCount: finiteNumberOrNull(value.liveCandidateCount),
    afterServiceFilterCount: finiteNumberOrNull(value.afterServiceFilterCount),
    fallbackReason: fallbackReason(value.fallbackReason),
    isFallback: typeof value.isFallback === 'boolean' ? value.isFallback : false,
    limit: filter.limit,
  });
  if (typeof value.finalCardsCount === 'number' && Number.isFinite(value.finalCardsCount)) {
    diagnostics.finalCardsCount = value.finalCardsCount;
  }
  return diagnostics;
}

export function normalizeTitleQueryData(data: unknown, filter: TitleQueryFilter): TitleQueryResult {
  if (Array.isArray(data)) {
    const titles = titleArrayFromCache(data);
    return {
      titles,
      diagnostics: makeDiagnostics({ titles, limit: filter.limit }),
    };
  }

  if (isRecord(data) && 'titles' in data) {
    const titles = titleArrayFromCache(data.titles);
    return {
      titles,
      diagnostics: normalizedDiagnostics(data.diagnostics, titles, filter),
    };
  }

  const titles: Title[] = [];
  return {
    titles,
    diagnostics: makeDiagnostics({ titles, limit: filter.limit }),
  };
}
