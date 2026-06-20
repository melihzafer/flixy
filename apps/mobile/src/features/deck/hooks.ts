import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MoodPreset, TasteSignal } from '@flixy/shared';
import { type ComposeOptions, type ComposeResult, composeDeck, moodToFilter } from '@flixy/shared';

import { normalizeGenreId, normalizeServiceId } from '../../lib/fallbackCatalogue';
import { localDb } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import {
  type CatalogueDiagnostics,
  type CatalogueFallbackReason,
  type TitleQueryFilter,
  useTitlesByIds,
  useTitlesQuery,
} from '../catalogue/hooks';
import { useUserPreferences } from '../onboarding/hooks';
import { useProfile } from '../profile/hooks';
import { events } from '../telemetry/events';
import { watchlistStore } from '../watchlist/store';
import { useDeckFilters } from './filterStore';

export type RecommendationItem = {
  titleId: string;
  type: 'vector' | 'collab';
  score: number;
};

export function useDeckRecommendations() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  return useQuery({
    queryKey: ['deck_recommendations', userId],
    enabled: isSupabaseConfigured && !!userId,
    queryFn: async (): Promise<RecommendationItem[]> => {
      if (!userId) return [];
      try {
        // Fetch Content-Based vector similarity recommendations
        const { data: vectorData, error: vectorError } = await supabase.rpc(
          'recommend_titles_by_watchlist',
          { p_user_id: userId, p_limit: 15 },
        );

        // Fetch Collaborative recommendations
        const { data: collabData, error: collabError } = await supabase.rpc(
          'get_collaborative_recommendations',
          { p_user_id: userId, p_limit: 15 },
        );

        const recommendationsMap = new Map<string, RecommendationItem>();

        if (!vectorError && Array.isArray(vectorData)) {
          for (const row of vectorData) {
            const id = String(row.title_id);
            recommendationsMap.set(id, {
              titleId: id,
              type: 'vector',
              score: Number(row.similarity ?? 0.5),
            });
          }
        } else if (vectorError) {
          logger.warn('Supabase recommend_titles_by_watchlist rpc failed', { error: vectorError });
        }

        if (!collabError && Array.isArray(collabData)) {
          for (const row of collabData) {
            const id = String(row.title_id);
            const existing = recommendationsMap.get(id);
            const count = Number(row.co_occurrence_count ?? 1);
            // Normalize counts to score (e.g. 1 -> 0.3, 5+ -> 0.8)
            const collabScore = Math.min(0.9, 0.2 + count * 0.1);

            if (existing) {
              // Boost score if found in both content and collab algorithms
              recommendationsMap.set(id, {
                titleId: id,
                type: 'vector',
                score: Math.min(1.0, existing.score + collabScore * 0.3),
              });
            } else {
              recommendationsMap.set(id, {
                titleId: id,
                type: 'collab',
                score: collabScore,
              });
            }
          }
        } else if (collabError) {
          logger.warn('Supabase get_collaborative_recommendations rpc failed', {
            error: collabError,
          });
        }

        return Array.from(recommendationsMap.values());
      } catch (e) {
        logger.warn('Failed to fetch remote recommendations from Supabase', { error: String(e) });
        return [];
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

/**
 * When the remaining deck drops below this threshold, fetch the next TMDB
 * page and merge it into the candidate pool.
 */
const DECK_REFILL_THRESHOLD = 5;
const MAX_PAGES_PER_SESSION = 5;

/**
 * Deck queries (FSD section 3.5). Wraps the catalogue query with the on-device
 * 7-layer composer and the user's current taste signal + cool-down sets.
 */

const EMPTY_TASTE: TasteSignal = {
  positiveGenres: {},
  negativeGenres: {},
  totalSwipes: 0,
};

function useTasteSignal(): TasteSignal {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const { data } = useQuery({
    queryKey: ['taste_signal', userId],
    enabled: !!userId,
    queryFn: async (): Promise<TasteSignal> => {
      if (!userId) return EMPTY_TASTE;
      const swipes = await localDb.getSwipes(userId);
      const positiveGenres: Record<string, number> = {};
      const negativeGenres: Record<string, number> = {};
      let totalSwipes = 0;

      for (const row of swipes) {
        if (row.is_undone) continue;
        totalSwipes++;
        if (Array.isArray(row.genres)) {
          const isPositive = row.direction === 'right' || row.direction === 'up';
          const isNegative = row.direction === 'left' || row.direction === 'down';

          if (isPositive) {
            for (const genre of row.genres) {
              positiveGenres[genre] = (positiveGenres[genre] || 0) + 1;
            }
          } else if (isNegative) {
            for (const genre of row.genres) {
              negativeGenres[genre] = (negativeGenres[genre] || 0) + 1;
            }
          }
        }
      }

      return {
        positiveGenres,
        negativeGenres,
        totalSwipes,
      };
    },
  });
  return data ?? EMPTY_TASTE;
}

function useDeckExclusions() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const { data } = useQuery({
    queryKey: ['deck_exclusions', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        return {
          excludeIds: new Set<string>(),
          passedRecently: new Set<string>(),
          shownLast7d: new Set<string>(),
        };
      }

      const sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const [swipes, watchlist] = await Promise.all([
        localDb.getSwipes(userId),
        watchlistStore.getWatchlist(userId),
      ]);

      const excludeIds = new Set<string>();
      const passedRecently = new Set<string>();
      const shownLast7d = new Set<string>();

      for (const row of swipes) {
        if (row.is_undone) continue;
        const titleId = String(row.title_id);

        // Add to exclusions unconditionally to never repeat swiped titles
        excludeIds.add(titleId);

        const occurredTime = new Date(row.occurred_at).getTime();
        if (occurredTime >= sinceMs) {
          shownLast7d.add(titleId);
          if (row.direction === 'left') passedRecently.add(titleId);
        }
      }
      for (const row of watchlist) {
        excludeIds.add(String(row.title_id));
      }

      return { excludeIds, passedRecently, shownLast7d };
    },
  });

  return (
    data ?? {
      excludeIds: new Set<string>(),
      passedRecently: new Set<string>(),
      shownLast7d: new Set<string>(),
    }
  );
}

export type UseDeckOptions = {
  mood?: MoodPreset | null;
  extraFilter?: Partial<TitleQueryFilter>;
};

export type DeckEmptyReason =
  | CatalogueFallbackReason
  | 'filter_overconstrained'
  | 'relaxed'
  | 'none';

export type DeckDiagnostics = Omit<CatalogueDiagnostics, 'emptyReason' | 'finalCardsCount'> & {
  finalCardsCount: number;
  eligibleCount: number;
  excludedCount: number;
  emptyReason: DeckEmptyReason | null;
  isRelaxed: boolean;
  relaxedCandidateCount: number | null;
};

function hasRestrictiveFilter(filter: TitleQueryFilter, maxRuntime?: number): boolean {
  return Boolean(
    (filter.serviceIds?.length ?? 0) > 0 ||
      (filter.genres?.length ?? 0) > 0 ||
      filter.minYear != null ||
      filter.maxYear != null ||
      maxRuntime != null,
  );
}

function makeRelaxedFilter(filter: TitleQueryFilter): TitleQueryFilter {
  return {
    region: filter.region,
    kinds: filter.kinds,
    limit: filter.limit,
  };
}

function enrichDeckDiagnostics(input: {
  catalogue: CatalogueDiagnostics;
  composed: ComposeResult;
  isRelaxed: boolean;
  relaxedCandidateCount: number | null;
  hasRestrictiveFilters: boolean;
}): DeckDiagnostics {
  const finalCardsCount = input.composed.cards.length;
  let emptyReason: DeckEmptyReason | null = input.catalogue.emptyReason;
  if (finalCardsCount === 0) {
    if (input.catalogue.isFallback && input.catalogue.fallbackReason) {
      emptyReason = input.catalogue.fallbackReason;
    } else if (input.hasRestrictiveFilters) {
      emptyReason = 'filter_overconstrained';
    } else {
      emptyReason = input.catalogue.candidateCount === 0 ? 'filtered_empty' : 'exhausted';
    }
  } else if (input.isRelaxed) {
    emptyReason = 'relaxed';
  }

  return {
    ...input.catalogue,
    finalCardsCount,
    isNarrow: input.catalogue.isNarrow || input.composed.isNarrow,
    emptyReason,
    isRelaxed: input.isRelaxed,
    relaxedCandidateCount: input.relaxedCandidateCount,
    eligibleCount: input.composed.diagnostics.eligibleCount,
    excludedCount: input.composed.diagnostics.excludedCount,
  };
}

export function useDeck(options: UseDeckOptions = {}) {
  const { data: prefs } = useUserPreferences();
  const { data: profile } = useProfile();
  const taste = useTasteSignal();
  const exclusions = useDeckExclusions();
  const moodFilter = moodToFilter(options.mood ?? null);
  const [refillPage, setRefillPage] = useState(1);
  const filterServices = useDeckFilters((s) => s.serviceIds);
  const filterGenres = useDeckFilters((s) => s.genres);

  const selectedServices = useMemo(
    () => filterServices ?? prefs?.selected_services.map(normalizeServiceId) ?? undefined,
    [filterServices, prefs?.selected_services],
  );
  const selectedGenres = useMemo(
    () => filterGenres ?? prefs?.selected_genres.map(normalizeGenreId) ?? undefined,
    [filterGenres, prefs?.selected_genres],
  );

  const baseFilter: TitleQueryFilter = useMemo(
    () => ({
      region: profile?.region,
      serviceIds: selectedServices,
      genres: moodFilter.genres ?? selectedGenres,
      minYear: moodFilter.minYear,
      maxYear: moodFilter.maxYear,
      limit: 80,
      page: refillPage,
      ...options.extraFilter,
    }),
    [
      profile?.region,
      selectedServices,
      selectedGenres,
      moodFilter.genres,
      moodFilter.minYear,
      moodFilter.maxYear,
      refillPage,
      options.extraFilter,
    ],
  );

  const candidatesQuery = useTitlesQuery(baseFilter);
  const hasStrictFilters = hasRestrictiveFilter(baseFilter, moodFilter.maxRuntime);
  const relaxedFilter = useMemo(() => makeRelaxedFilter(baseFilter), [baseFilter]);
  const relaxedCandidatesQuery = useTitlesQuery(relaxedFilter, { enabled: hasStrictFilters });

  const recoQuery = useDeckRecommendations();
  const recoIds = useMemo(() => recoQuery.data?.map((r) => r.titleId) ?? [], [recoQuery.data]);
  const recoTitlesQuery = useTitlesByIds(recoIds);

  const recommendationScores = useMemo(() => {
    const scores: Record<string, number> = {};
    if (recoQuery.data) {
      for (const item of recoQuery.data) {
        scores[item.titleId] = item.score;
      }
    }
    return scores;
  }, [recoQuery.data]);

  const composeOpts: Omit<ComposeOptions, 'candidates'> = useMemo(
    () => ({
      taste,
      ownedServiceIds: selectedServices ?? [],
      passedRecently: exclusions.passedRecently,
      shownLast7d: exclusions.shownLast7d,
      excludeIds: exclusions.excludeIds,
      targetSize: 50,
      recommendationScores,
    }),
    [taste, selectedServices, exclusions, recommendationScores],
  );

  const primaryDeck = useMemo(() => {
    if (!candidatesQuery.data) return null;
    let candidates = candidatesQuery.data.titles ?? [];

    // Merge remote recommendations if present
    const recommendedTitles = recoTitlesQuery.data ?? [];
    if (recommendedTitles.length > 0) {
      const seenIds = new Set(candidates.map((t) => t.id));
      const merged = [...candidates];
      for (const t of recommendedTitles) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          merged.push(t);
        }
      }
      candidates = merged;
    }

    // Strict genre filter: only allow candidates whose genres are a subset of selectedGenres
    if (selectedGenres && selectedGenres.length > 0) {
      const selectedSet = new Set(selectedGenres);
      candidates = candidates.filter((t) =>
        t.genres.every((g) => selectedSet.has(normalizeGenreId(g))),
      );
    }

    if (moodFilter.maxRuntime != null) {
      const cap = moodFilter.maxRuntime;
      const filtered = candidates.filter(
        (t) => t.runtimeMinutes == null || t.runtimeMinutes <= cap,
      );
      return composeDeck({ ...composeOpts, candidates: filtered });
    }
    return composeDeck({ ...composeOpts, candidates });
  }, [
    candidatesQuery.data,
    recoTitlesQuery.data,
    composeOpts,
    moodFilter.maxRuntime,
    selectedGenres,
  ]);

  const relaxedDeck = useMemo(() => {
    if (!relaxedCandidatesQuery.data) return null;
    let candidates = relaxedCandidatesQuery.data.titles ?? [];

    // Strict genre filter: only allow candidates whose genres are a subset of selectedGenres
    if (selectedGenres && selectedGenres.length > 0) {
      const selectedSet = new Set(selectedGenres);
      candidates = candidates.filter((t) =>
        t.genres.every((g) => selectedSet.has(normalizeGenreId(g))),
      );
    }

    return composeDeck({
      ...composeOpts,
      candidates,
    });
  }, [relaxedCandidatesQuery.data, composeOpts, selectedGenres]);

  const useRelaxedDeck =
    Boolean(hasStrictFilters) &&
    (primaryDeck?.cards.length ?? 0) === 0 &&
    (relaxedDeck?.cards.length ?? 0) > 0;

  const deck = useRelaxedDeck ? relaxedDeck : primaryDeck;
  const activeCatalogueDiagnostics = useRelaxedDeck
    ? relaxedCandidatesQuery.data?.diagnostics
    : candidatesQuery.data?.diagnostics;
  const diagnostics = useMemo(
    () =>
      deck && activeCatalogueDiagnostics
        ? enrichDeckDiagnostics({
            catalogue: activeCatalogueDiagnostics,
            composed: deck,
            isRelaxed: useRelaxedDeck,
            relaxedCandidateCount: relaxedCandidatesQuery.data?.diagnostics.candidateCount ?? null,
            hasRestrictiveFilters: hasStrictFilters,
          })
        : null,
    [
      activeCatalogueDiagnostics,
      deck,
      hasStrictFilters,
      relaxedCandidatesQuery.data?.diagnostics.candidateCount,
      useRelaxedDeck,
    ],
  );

  // Reset the page counter whenever the underlying filter inputs change so a
  // region/service/genre switch does not leak the previous page number.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger on filter identity; setRefillPage is stable from useState.
  useEffect(() => {
    setRefillPage(1);
  }, [baseFilter]);

  // Deck refill: when the visible deck drops below the threshold, fetch the
  // next TMDB page. Bounded by MAX_PAGES_PER_SESSION so we never loop forever.
  const lastRefillTriggerRef = useRef<number>(0);
  useEffect(() => {
    const remaining = deck?.cards.length ?? 0;
    if (
      remaining > 0 &&
      remaining <= DECK_REFILL_THRESHOLD &&
      refillPage < MAX_PAGES_PER_SESSION &&
      lastRefillTriggerRef.current !== deck?.cards.length
    ) {
      lastRefillTriggerRef.current = remaining;
      setRefillPage((p) => p + 1);
    }
  }, [deck?.cards.length, refillPage]);

  useEffect(() => {
    if (!diagnostics) return;
    events.deckDiagnosticsCaptured({
      liveCandidateCount: diagnostics.liveCandidateCount,
      candidateCount: diagnostics.candidateCount,
      eligibleCount: diagnostics.eligibleCount,
      finalCardsCount: diagnostics.finalCardsCount,
      fallbackReason: diagnostics.fallbackReason,
      emptyReason: diagnostics.emptyReason,
      isFallback: diagnostics.isFallback,
      isNarrow: diagnostics.isNarrow,
      isRelaxed: diagnostics.isRelaxed,
    });
  }, [diagnostics]);

  const refetch = useCallback(async () => {
    setRefillPage(1);
    await Promise.all([candidatesQuery.refetch(), relaxedCandidatesQuery.refetch()]);
  }, [candidatesQuery, relaxedCandidatesQuery]);

  return {
    deck,
    diagnostics,
    isLoading:
      candidatesQuery.isLoading ||
      (hasStrictFilters &&
        (primaryDeck?.cards.length ?? 0) === 0 &&
        relaxedCandidatesQuery.isLoading),
    isError: candidatesQuery.isError,
    error: candidatesQuery.error,
    refetch,
  };
}
