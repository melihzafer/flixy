import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MoodPreset, TasteSignal, Title, VibePreset } from '@flixy/shared';
import {
  type ComposeOptions,
  type ComposeResult,
  buildWatchlistTasteSignal,
  composeDeck,
  moodToFilter,
  vibesToGenres,
  withColdStartPrior,
} from '@flixy/shared';

import { normalizeGenreId, normalizeServiceId } from '../../lib/fallbackCatalogue';
import { localDb } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { fetchTmdbTitlesByIds } from '../../lib/tmdb';
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
import { resolveDeckFilterPolicy, titleMatchesDeckPolicy } from './filterPolicy';
import { useDeckFilters } from './filterStore';

export type RecommendationItem = {
  titleId: string;
  type: 'vector' | 'collab' | 'community';
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

        const { data: communityData, error: communityError } = await supabase.rpc(
          'get_top_favorite_cards',
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

        if (!communityError && Array.isArray(communityData)) {
          for (const row of communityData) {
            const id = String(row.title_id);
            const existing = recommendationsMap.get(id);
            const saves = Number(row.save_count ?? 1);
            const tops = Number(row.top_count ?? 0);
            const communityScore = Math.min(0.88, 0.25 + saves * 0.04 + tops * 0.08);

            recommendationsMap.set(id, {
              titleId: id,
              type: existing?.type ?? 'community',
              score: Math.min(1, Math.max(existing?.score ?? 0, communityScore)),
            });
          }
        } else if (communityError) {
          logger.warn('Supabase get_top_favorite_cards rpc failed', {
            error: communityError,
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
const MAX_PAGES_PER_SESSION = 10;
const DECK_PAGE_SIZE = 20;

/**
 * Per-app-launch salt mixed into the composer's userSeed. The composed feed is
 * deliberately deterministic for a given set of inputs (deck stability
 * invariant), which also meant two consecutive app opens produced the exact
 * same deck — TMDB's popularity order barely moves hour to hour. Salting the
 * jitter seed per launch keeps ordering rock-stable WITHIN a session while
 * giving every fresh open a visibly re-shuffled arrangement of near-tied
 * cards. Real preference gaps still dominate the jitter magnitude.
 */
const LAUNCH_SEED = `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;

/**
 * Deck queries (FSD section 3.5). Wraps the catalogue query with the on-device
 * 7-layer composer and the user's current taste signal + cool-down sets.
 */

const EMPTY_TASTE: TasteSignal = {
  positiveGenres: {},
  negativeGenres: {},
  positiveLanguages: {},
  negativeLanguages: {},
  positiveKinds: {},
  negativeKinds: {},
  totalSwipes: 0,
};

type RemoteSwipeRow = {
  event_id: string;
  title_id: string;
  direction: string;
  occurred_at: string;
  is_undone: boolean;
  title_snapshot: {
    genres?: string[];
    language?: string | null;
    kind?: 'movie' | 'tv' | null;
  } | null;
};

async function fetchRemoteSwipeRows(userId: string): Promise<RemoteSwipeRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('swipes')
      .select('event_id,title_id,direction,occurred_at,is_undone,title_snapshot')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(500);
    if (error) {
      // Existing installations can be one deploy behind the title_snapshot
      // migration. Keep cross-device exclusions working there; only the new
      // language/type learning is unavailable until the migration lands.
      const legacy = await supabase
        .from('swipes')
        .select('event_id,title_id,direction,occurred_at,is_undone')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(500);
      if (legacy.error) {
        logger.warn('Could not load remote swipe history', { error: legacy.error });
        return [];
      }
      return (legacy.data ?? []).map((row) => ({
        ...(row as Omit<RemoteSwipeRow, 'title_snapshot'>),
        title_snapshot: null,
      }));
    }
    return (data ?? []) as RemoteSwipeRow[];
  } catch (error) {
    logger.warn('Could not load remote swipe history', { error: String(error) });
    return [];
  }
}

function useTasteSignal(): { taste: TasteSignal; isLoading: boolean } {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const { data: prefs } = useUserPreferences();
  const { data, isLoading } = useQuery({
    queryKey: ['taste_signal', userId],
    enabled: !!userId,
    queryFn: async (): Promise<TasteSignal> => {
      if (!userId) return EMPTY_TASTE;
      const [localSwipes, remoteSwipes, watchlist] = await Promise.all([
        localDb.getSwipes(userId),
        fetchRemoteSwipeRows(userId),
        watchlistStore.getWatchlist(userId),
      ]);
      const swipes = new Map<
        string,
        {
          direction: string;
          title_id: string;
          occurred_at: string;
          is_undone?: boolean;
          title_snapshot?: RemoteSwipeRow['title_snapshot'];
        }
      >();
      for (const row of localSwipes) {
        swipes.set(row.event_id, row);
      }
      for (const row of remoteSwipes) {
        if (!swipes.has(row.event_id)) swipes.set(row.event_id, row);
      }
      const titles = await fetchTmdbTitlesByIds(watchlist.map((item) => item.title_id));
      const titleById = new Map(titles.map((title) => [title.id, title]));
      return buildWatchlistTasteSignal(
        watchlist.flatMap((item) => {
          const title = titleById.get(item.title_id);
          if (!title) return [];
          return [
            {
              priority: item.priority,
              watchedAt: item.watched_at,
              genres: title.genres,
              language: title.language,
              kind: title.kind,
            },
          ];
        }),
        Array.from(swipes.values()).map((row) => ({
          direction: row.direction,
          itemId: row.title_id,
          genres: row.title_snapshot?.genres ?? [],
          language: row.title_snapshot?.language,
          kind: row.title_snapshot?.kind,
          occurredAt: row.occurred_at,
          isUndone: row.is_undone,
        })),
      );
    },
  });

  // Onboarding genre selection seeds the profile so brand-new users get
  // genre-aware ranking instead of pure popularity. Real swipes quickly
  // outweigh the fixed prior.
  const coldStartGenres = useMemo(
    () => prefs?.selected_genres?.map(normalizeGenreId) ?? null,
    [prefs?.selected_genres],
  );
  const taste = useMemo(
    () => withColdStartPrior(data ?? EMPTY_TASTE, coldStartGenres),
    [data, coldStartGenres],
  );
  return { taste, isLoading: !!userId && isLoading };
}

function useDeckExclusions() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const { data, isLoading, isError, refetch } = useQuery({
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
      // The watchlist read is NOT best-effort: composing a deck without it is
      // exactly the "my watchlist keeps showing up" bug. Let the query throw
      // and retry instead of silently proceeding with an empty exclusion set.
      const [localSwipes, remoteSwipes, watchlist, impressions] = await Promise.all([
        localDb.getSwipes(userId),
        fetchRemoteSwipeRows(userId),
        watchlistStore.getWatchlist(userId),
        localDb.getRecentImpressions(userId),
      ]);
      const swipes = new Map<
        string,
        {
          title_id: string;
          direction: string;
          occurred_at: string;
          is_undone?: boolean;
        }
      >();
      for (const row of localSwipes) swipes.set(row.event_id, row);
      for (const row of remoteSwipes) {
        if (!swipes.has(row.event_id)) swipes.set(row.event_id, row);
      }

      const excludeIds = new Set<string>();
      const passedRecently = new Set<string>();
      const shownLast7d = new Set<string>();

      const addSwipe = (titleId: string, direction: string, occurredAt: string) => {
        // Add to exclusions unconditionally to never repeat swiped titles
        excludeIds.add(titleId);
        const occurredTime = new Date(occurredAt).getTime();
        if (occurredTime >= sinceMs) {
          shownLast7d.add(titleId);
          if (direction === 'left') passedRecently.add(titleId);
        }
      };

      for (const row of swipes.values()) {
        if (row.is_undone) continue;
        addSwipe(String(row.title_id), row.direction, row.occurred_at);
      }
      for (const row of watchlist) {
        excludeIds.add(String(row.title_id));
      }
      // Cards the user SAW at the top of the deck but never swiped. These are
      // not excluded — only cooldown-demoted by the composer — so a fresh app
      // open leads with unseen titles instead of replaying yesterday's deck.
      for (const titleId of impressions) {
        shownLast7d.add(titleId);
      }

      return { excludeIds, passedRecently, shownLast7d };
    },
  });

  return {
    exclusions: data ?? {
      excludeIds: new Set<string>(),
      passedRecently: new Set<string>(),
      shownLast7d: new Set<string>(),
    },
    /** True only when exclusions actually resolved — never compose without them. */
    isReady: !userId || data != null,
    isLoading: !!userId && isLoading,
    isError,
    refetch,
  };
}

export type UseDeckOptions = {
  mood?: MoodPreset | null;
  vibes?: VibePreset[] | null;
  country?: string | null;
  /** For You mode leans on taste + remote recos while preserving manual filters. */
  forYou?: boolean;
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
      (filter.vibeGenres?.length ?? 0) > 0 ||
      filter.originCountry != null ||
      filter.minYear != null ||
      filter.maxYear != null ||
      maxRuntime != null,
  );
}

// ISO-3166 alpha-2 -> ISO-639-1 original language used to filter the merged
// candidate pool client-side when a country filter is active.
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

function appendUniqueTitles(existing: Title[], next: Title[]): Title[] {
  if (next.length === 0) return existing;
  const seen = new Set(existing.map((title) => title.id));
  const merged = [...existing];
  for (const title of next) {
    if (seen.has(title.id)) continue;
    seen.add(title.id);
    merged.push(title);
  }
  return merged;
}

export function useDeck(options: UseDeckOptions = {}) {
  const { data: session, isLoading: isSessionLoading } = useSession();
  const userId = session?.user?.id ?? null;
  const { data: prefs, isLoading: isPrefsLoading } = useUserPreferences();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const { taste, isLoading: isTasteLoading } = useTasteSignal();
  const {
    exclusions,
    isReady: areExclusionsReady,
    isLoading: isExclusionsLoading,
    isError: isExclusionsError,
    refetch: refetchExclusions,
  } = useDeckExclusions();
  const moodFilter = moodToFilter(options.mood ?? null);
  const forYou = options.forYou === true;
  const [refillPage, setRefillPage] = useState(1);
  const filterServices = useDeckFilters((s) => s.serviceIds);
  const filterGenres = useDeckFilters((s) => s.genres);
  const filterExcludedGenres = useDeckFilters((s) => s.excludedGenres);
  const filterLanguages = useDeckFilters((s) => s.languages);
  const filterExcludedLanguages = useDeckFilters((s) => s.excludedLanguages);
  const filterMinRuntime = useDeckFilters((s) => s.minRuntime);
  const filterMaxRuntime = useDeckFilters((s) => s.maxRuntime);

  const selectedGenres = useMemo(
    () => filterGenres ?? prefs?.selected_genres.map(normalizeGenreId) ?? undefined,
    [filterGenres, prefs?.selected_genres],
  );

  const policy = useMemo(
    () =>
      resolveDeckFilterPolicy(
        {
          selectedGenres: prefs?.selected_genres.map(normalizeGenreId) ?? [],
          // Optional-chained past prefs: a persisted query-cache entry written
          // before the excluded_genres migration restores without this field.
          excludedGenres: prefs?.excluded_genres?.map(normalizeGenreId) ?? [],
          preferredLanguages: prefs?.preferred_languages ?? [],
          excludedLanguages: prefs?.excluded_languages ?? [],
          selectedServices: prefs?.selected_services.map(normalizeServiceId) ?? [],
        },
        {
          kinds: options.extraFilter?.kinds ?? ['movie', 'tv'],
          serviceIds: filterServices,
          genres: filterGenres?.map(normalizeGenreId) ?? null,
          excludedGenres: filterExcludedGenres?.map(normalizeGenreId) ?? null,
          languages: filterLanguages,
          excludedLanguages: filterExcludedLanguages,
          minYear: options.extraFilter?.minYear ?? null,
          maxYear: options.extraFilter?.maxYear ?? null,
          minRuntime: filterMinRuntime,
          maxRuntime: filterMaxRuntime,
          originCountryLanguage: options.country
            ? (COUNTRY_LANGUAGE_MAP[options.country.toUpperCase()] ?? null)
            : null,
        },
      ),
    [
      filterExcludedGenres,
      filterExcludedLanguages,
      filterLanguages,
      filterMaxRuntime,
      filterMinRuntime,
      filterServices,
      filterGenres,
      options.country,
      options.extraFilter?.kinds,
      options.extraFilter?.maxYear,
      options.extraFilter?.minYear,
      prefs?.excluded_genres,
      prefs?.excluded_languages,
      prefs?.preferred_languages,
      prefs?.selected_genres,
      prefs?.selected_services,
    ],
  );

  const vibeGenres = useMemo(
    () => vibesToGenres(options.vibes ?? null) ?? undefined,
    [options.vibes],
  );

  const baseFilter: TitleQueryFilter = useMemo(
    () => ({
      region: profile?.region,
      // For You is a ranking mode, never a bypass for settings. Queries stay
      // broad enough for the composer, then the same strict policy runs after
      // remote/fallback candidates are merged.
      serviceIds: policy.serviceIds.length > 0 ? policy.serviceIds : undefined,
      genres: policy.includeGenres.length > 0 ? policy.includeGenres : undefined,
      vibeGenres,
      originCountry: options.country ?? undefined,
      minYear: policy.minYear ?? moodFilter.minYear,
      maxYear: policy.maxYear ?? moodFilter.maxYear,
      limit: DECK_PAGE_SIZE,
      ...options.extraFilter,
    }),
    [
      profile?.region,
      policy,
      vibeGenres,
      options.country,
      moodFilter.minYear,
      moodFilter.maxYear,
      options.extraFilter,
    ],
  );

  // The query only carries constraints TMDB can express. The UI queue also
  // needs the client-only policy (blocked genres/languages and runtime) in its
  // identity; otherwise an already queued Animation card could survive after
  // the user explicitly blocks Animation.
  const filterKey = useMemo(
    () => JSON.stringify({ query: baseFilter, policy }),
    [baseFilter, policy],
  );
  const pagedFilter = useMemo(
    () => ({
      ...baseFilter,
      page: refillPage,
    }),
    [baseFilter, refillPage],
  );

  const candidatesQuery = useTitlesQuery(pagedFilter);
  const hasStrictFilters = hasRestrictiveFilter(baseFilter, moodFilter.maxRuntime);
  const relaxedFilter = useMemo(() => makeRelaxedFilter(baseFilter), [baseFilter]);
  const relaxedPagedFilter = useMemo(
    () => ({
      ...relaxedFilter,
      page: refillPage,
    }),
    [relaxedFilter, refillPage],
  );
  const relaxedCandidatesQuery = useTitlesQuery(relaxedPagedFilter, { enabled: hasStrictFilters });

  const [candidatePool, setCandidatePool] = useState<Title[]>([]);
  const [relaxedCandidatePool, setRelaxedCandidatePool] = useState<Title[]>([]);
  const [candidatePoolKey, setCandidatePoolKey] = useState(filterKey);
  const appendedPrimaryPagesRef = useRef<Set<string>>(new Set());
  const appendedRelaxedPagesRef = useRef<Set<string>>(new Set());

  // Remote recommendations (three Supabase RPCs) are deliberately NOT part of
  // the loading gate: the first TMDB page composes and paints immediately,
  // and recommendations merge in as a background enrichment. The screen's
  // append-only card queue makes the late merge invisible to the user.
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
      ownedServiceIds: policy.serviceIds,
      passedRecently: exclusions.passedRecently,
      shownLast7d: exclusions.shownLast7d,
      excludeIds: exclusions.excludeIds,
      targetSize: 50,
      recommendationScores,
      userSeed: userId ? `${userId}:${LAUNCH_SEED}` : null,
      vibes: forYou ? null : (options.vibes ?? null),
      preferredCountries: forYou ? null : options.country ? [options.country] : null,
      forYou,
    }),
    [
      taste,
      policy.serviceIds,
      exclusions,
      recommendationScores,
      userId,
      forYou,
      options.vibes,
      options.country,
    ],
  );

  // Never compose while exclusions/taste are still resolving: an early compose
  // with empty exclusion sets leaks watchlist + already-swiped titles into the
  // screen's append-only card queue, where no later recomposition can remove
  // them. (This was the main "my watchlist keeps showing up" path.)
  const canCompose = areExclusionsReady && !isTasteLoading;

  const primaryDeck = useMemo(() => {
    if (!canCompose) return null;
    const pooledCandidates = candidatePoolKey === filterKey ? candidatePool : [];
    const firstPageCandidates = candidatesQuery.data?.titles ?? [];
    if (pooledCandidates.length === 0 && firstPageCandidates.length === 0) return null;
    let candidates = pooledCandidates.length > 0 ? pooledCandidates : firstPageCandidates;

    // Merge remote recommendations if present. In For You mode recommendations
    // are weighted more heavily by the composer, so we merge a larger share.
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

    // This is the final hard gate: recommendations are merged above and TMDB
    // cannot express primary-genre and language-block semantics precisely.
    candidates = candidates.filter((title) => titleMatchesDeckPolicy(title, policy));

    if (moodFilter.genres && moodFilter.genres.length > 0) {
      const moodSet = new Set(moodFilter.genres.map(normalizeGenreId));
      candidates = candidates.filter((title) =>
        title.genres.some((genre) => moodSet.has(normalizeGenreId(genre))),
      );
    }

    // Vibe genre filter (mirror of the genre inclusive match for vibe presets).
    if (vibeGenres && vibeGenres.length > 0) {
      const vibeSet = new Set(vibeGenres);
      candidates = candidates.filter((t) => t.genres.some((g) => vibeSet.has(normalizeGenreId(g))));
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
    canCompose,
    candidatePool,
    candidatePoolKey,
    candidatesQuery.data,
    filterKey,
    recoTitlesQuery.data,
    composeOpts,
    moodFilter.genres,
    moodFilter.maxRuntime,
    policy,
    vibeGenres,
  ]);

  const relaxedDeck = useMemo(() => {
    if (!canCompose) return null;
    const pooledCandidates = candidatePoolKey === filterKey ? relaxedCandidatePool : [];
    const firstPageCandidates = relaxedCandidatesQuery.data?.titles ?? [];
    if (pooledCandidates.length === 0 && firstPageCandidates.length === 0) return null;
    let candidates = pooledCandidates.length > 0 ? pooledCandidates : firstPageCandidates;

    // Inclusive genre filter (match at least one selected genre) — see primaryDeck.
    if (!forYou && selectedGenres && selectedGenres.length > 0) {
      const selectedSet = new Set(selectedGenres);
      candidates = candidates.filter((t) =>
        t.genres.some((g) => selectedSet.has(normalizeGenreId(g))),
      );
    }

    if (!forYou && vibeGenres && vibeGenres.length > 0) {
      const vibeSet = new Set(vibeGenres);
      candidates = candidates.filter((t) => t.genres.some((g) => vibeSet.has(normalizeGenreId(g))));
    }

    if (!forYou && options.country) {
      const countryLang = COUNTRY_LANGUAGE_MAP[options.country.toUpperCase()];
      if (countryLang) {
        candidates = candidates.filter((t) =>
          (t.language ?? '').toLowerCase().startsWith(countryLang),
        );
      }
    }

    const kinds = baseFilter.kinds;
    if (kinds && kinds.length > 0 && kinds.length < 2) {
      candidates = candidates.filter((t) => kinds.includes(t.kind));
    }

    return composeDeck({
      ...composeOpts,
      candidates,
    });
  }, [
    canCompose,
    candidatePoolKey,
    composeOpts,
    filterKey,
    relaxedCandidatePool,
    relaxedCandidatesQuery.data,
    selectedGenres,
    vibeGenres,
    options.country,
    forYou,
    baseFilter.kinds,
  ]);

  // A strict filter must never silently fall back to a broader deck. Showing
  // an honest empty state is the only safe result when no eligible title
  // exists; users can deliberately broaden/reset from that state.
  const useRelaxedDeck = false;

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
    ],
  );

  // Reset lazy-loaded pages whenever the real filter changes. Page changes are
  // not part of this key, otherwise refills would erase the accumulated pool.
  useEffect(() => {
    setCandidatePool([]);
    setRelaxedCandidatePool([]);
    setCandidatePoolKey(filterKey);
    appendedPrimaryPagesRef.current = new Set();
    appendedRelaxedPagesRef.current = new Set();
    setRefillPage(1);
  }, [filterKey]);

  useEffect(() => {
    const page = candidatesQuery.data;
    if (!page || candidatePoolKey !== filterKey) return;
    const pageKey = `${filterKey}:primary:${refillPage}`;
    if (appendedPrimaryPagesRef.current.has(pageKey)) return;
    appendedPrimaryPagesRef.current.add(pageKey);
    setCandidatePool((prev) => appendUniqueTitles(prev, page.titles));
  }, [candidatePoolKey, candidatesQuery.data, filterKey, refillPage]);

  useEffect(() => {
    const page = relaxedCandidatesQuery.data;
    if (!page || candidatePoolKey !== filterKey) return;
    const pageKey = `${filterKey}:relaxed:${refillPage}`;
    if (appendedRelaxedPagesRef.current.has(pageKey)) return;
    appendedRelaxedPagesRef.current.add(pageKey);
    setRelaxedCandidatePool((prev) => appendUniqueTitles(prev, page.titles));
  }, [candidatePoolKey, filterKey, refillPage, relaxedCandidatesQuery.data]);

  // Deck refill: when the composed deck drops to or below the threshold —
  // INCLUDING zero — fetch the next TMDB page. An empty deck must keep
  // refilling (this is what made "For You" declare itself exhausted after a
  // single compose: `remaining > 0` meant a deck that hit 0 never fetched
  // again). Bounded by MAX_PAGES_PER_SESSION and gated on the current page
  // having settled so we advance one page at a time, never in a loop.
  useEffect(() => {
    if (!canCompose) return;
    const remaining = deck?.cards.length ?? 0;
    if (remaining > DECK_REFILL_THRESHOLD) return;
    if (refillPage >= MAX_PAGES_PER_SESSION) return;
    if (candidatesQuery.isFetching || !candidatesQuery.data) return;
    setRefillPage((p) => p + 1);
  }, [
    canCompose,
    deck?.cards.length,
    refillPage,
    candidatesQuery.isFetching,
    candidatesQuery.data,
  ]);

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
    await Promise.all([
      candidatesQuery.refetch(),
      relaxedCandidatesQuery.refetch(),
      refetchExclusions(),
    ]);
  }, [candidatesQuery, relaxedCandidatesQuery, refetchExclusions]);

  const hardExcludedIds = useMemo(
    () => new Set(Object.keys(deck?.diagnostics.exclusions ?? {})),
    [deck],
  );

  return {
    deck,
    /** Queued UI cards with these ids must be removed instead of merely re-ranked. */
    hardExcludedIds,
    diagnostics,
    /**
     * Identity of the active filter context. Changes only when the user
     * actually changes filters — consumers use it to know when the visible
     * card stack should be rebuilt vs. kept stable across recompositions.
     */
    filterKey,
    /**
     * Live hard-exclusion set (swiped + watchlist title ids). The screen uses
     * it to drop already-queued cards when a title becomes excluded
     * mid-session (e.g. saved to the watchlist from search or title detail).
     */
    excludeIds: exclusions.excludeIds,
    isLoading:
      isSessionLoading ||
      isPrefsLoading ||
      isProfileLoading ||
      isTasteLoading ||
      isExclusionsLoading ||
      candidatesQuery.isLoading ||
      (hasStrictFilters &&
        (primaryDeck?.cards.length ?? 0) === 0 &&
        relaxedCandidatesQuery.isLoading),
    // A failed exclusions read is a deck-level error: composing without it
    // would show the user their own watchlist and repeats.
    isError: candidatesQuery.isError || isExclusionsError,
    error: candidatesQuery.error,
    refetch,
  };
}
