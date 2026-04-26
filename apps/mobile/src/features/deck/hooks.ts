import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { MoodPreset, TasteSignal } from '@flixy/shared';
import { type ComposeOptions, composeDeck, moodToFilter } from '@flixy/shared';

import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { type TitleQueryFilter, useTitlesQuery } from '../catalogue/hooks';
import { useUserPreferences } from '../onboarding/hooks';

/**
 * Deck queries (FSD section 3.5). Wraps the catalogue query with the on-device
 * 7-layer composer and the user's current taste signal + cool-down sets.
 *
 * The taste signal will be DB-backed once Phase 3.3 (swipe engine) lands. For
 * MVP we read aggregated genre counts from a `user_taste_signal` view that
 * does not exist yet; the hook degrades gracefully to a popularity deck when
 * the view is absent (cold-start path).
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
      // Attempt to read; if the view doesn't exist yet (pre-3.3) fall back.
      try {
        const { data: rows, error } = await supabase
          .from('user_taste_signal')
          .select('genre, polarity, count')
          .eq('user_id', userId);
        if (error) return EMPTY_TASTE;
        const positive: Record<string, number> = {};
        const negative: Record<string, number> = {};
        let total = 0;
        for (const r of rows ?? []) {
          const row = r as { genre: string; polarity: 'positive' | 'negative'; count: number };
          if (row.polarity === 'positive') positive[row.genre] = row.count;
          else negative[row.genre] = row.count;
          total += row.count;
        }
        return { positiveGenres: positive, negativeGenres: negative, totalSwipes: total };
      } catch {
        return EMPTY_TASTE;
      }
    },
  });
  return data ?? EMPTY_TASTE;
}

export type UseDeckOptions = {
  mood?: MoodPreset | null;
  extraFilter?: Partial<TitleQueryFilter>;
};

export function useDeck(options: UseDeckOptions = {}) {
  const { data: prefs } = useUserPreferences();
  const taste = useTasteSignal();
  const moodFilter = moodToFilter(options.mood ?? null);

  const filter: TitleQueryFilter = useMemo(
    () => ({
      region: undefined, // resolved server-side via profile.region in 3.7; for MVP undefined returns all
      serviceIds: prefs?.selected_services ?? undefined,
      genres: moodFilter.genres ?? prefs?.selected_genres ?? undefined,
      minYear: moodFilter.minYear,
      maxYear: moodFilter.maxYear,
      limit: 80,
      ...options.extraFilter,
    }),
    [
      prefs?.selected_services,
      prefs?.selected_genres,
      moodFilter.genres,
      moodFilter.minYear,
      moodFilter.maxYear,
      options.extraFilter,
    ],
  );

  const candidatesQuery = useTitlesQuery(filter);

  const composeOpts: Omit<ComposeOptions, 'candidates'> = useMemo(
    () => ({
      taste,
      ownedServiceIds: prefs?.selected_services ?? [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 50,
    }),
    [taste, prefs?.selected_services],
  );

  const deck = useMemo(() => {
    if (!candidatesQuery.data) return null;
    if (moodFilter.maxRuntime != null) {
      const cap = moodFilter.maxRuntime;
      const filtered = candidatesQuery.data.filter(
        (t) => t.runtimeMinutes == null || t.runtimeMinutes <= cap,
      );
      return composeDeck({ ...composeOpts, candidates: filtered });
    }
    return composeDeck({ ...composeOpts, candidates: candidatesQuery.data });
  }, [candidatesQuery.data, composeOpts, moodFilter.maxRuntime]);

  return {
    deck,
    isLoading: candidatesQuery.isLoading,
    isError: candidatesQuery.isError,
    error: candidatesQuery.error,
    refetch: candidatesQuery.refetch,
  };
}
