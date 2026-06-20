import type { Title } from '@flixy/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { FALLBACK_TITLES } from '../../lib/fallbackCatalogue';
import { logger } from '../../lib/logger';
import { searchTmdbTitles } from '../../lib/tmdb';
import type { CatalogueDiagnostics, CatalogueFallbackReason } from '../catalogue/hooks';

export type SearchTitlesResult = {
  titles: Title[];
  diagnostics: CatalogueDiagnostics;
  catalogueV2Enabled: boolean;
};

export type SearchUiState = 'idle' | 'searching' | 'results' | 'empty' | 'offline_fallback';

function fallbackSearch(query: string): Title[] {
  const needle = query.toLowerCase();
  return FALLBACK_TITLES.filter((title) => {
    const haystack = [
      title.title,
      title.originalTitle,
      title.overview,
      title.kind,
      title.releaseYear?.toString(),
      ...title.genres,
      ...title.availability.map((a) => a.serviceId),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  })
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 40);
}

function makeSearchResult(input: {
  titles: Title[];
  liveCandidateCount: number | null;
  fallbackReason: CatalogueFallbackReason | null;
  isFallback: boolean;
  catalogueV2Enabled: boolean;
}): SearchTitlesResult {
  return {
    titles: input.titles,
    catalogueV2Enabled: input.catalogueV2Enabled,
    diagnostics: {
      liveCandidateCount: input.liveCandidateCount,
      candidateCount: input.titles.length,
      afterServiceFilterCount: null,
      fallbackReason: input.fallbackReason,
      isFallback: input.isFallback,
      isNarrow: input.titles.length < 40,
      emptyReason: input.titles.length === 0 ? (input.fallbackReason ?? 'filtered_empty') : null,
    },
  };
}

export function getSearchUiState(input: {
  query: string;
  isFetching: boolean;
  result?: SearchTitlesResult | null;
}): SearchUiState {
  if (input.query.trim().length < 2) return 'idle';
  if (input.isFetching) return 'searching';
  const diagnostics = input.result?.diagnostics;
  if (diagnostics?.fallbackReason === 'query_failed') {
    return 'offline_fallback';
  }
  return (input.result?.titles.length ?? 0) > 0 ? 'results' : 'empty';
}

export function useSearchTitles(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['search', trimmed],
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      try {
        const liveResults = await searchTmdbTitles(trimmed);
        if (liveResults.length > 0) {
          return makeSearchResult({
            titles: liveResults,
            liveCandidateCount: liveResults.length,
            fallbackReason: null,
            isFallback: false,
            catalogueV2Enabled: false,
          });
        }

        return makeSearchResult({
          titles: [],
          liveCandidateCount: 0,
          fallbackReason: null,
          isFallback: false,
          catalogueV2Enabled: false,
        });
      } catch (error) {
        logger.warn('search query failed; using fallback search', {
          query: trimmed,
          message: error instanceof Error ? error.message : String(error),
        });
        return makeSearchResult({
          titles: fallbackSearch(trimmed),
          liveCandidateCount: null,
          fallbackReason: 'query_failed',
          isFallback: true,
          catalogueV2Enabled: false,
        });
      }
    },
  });
}
