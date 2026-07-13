import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MoodPreset, VibePreset } from '@flixy/shared';

export type DeckFilters = {
  /** "For You" mode ranks by taste + remote recos while still enforcing every filter. */
  forYou: boolean;
  mood: MoodPreset | null;
  vibes: VibePreset[] | null;
  /** Origin country ISO-3166 alpha-2; null = any country. */
  country: string | null;
  kinds: ('movie' | 'tv')[];
  minYear: number | null;
  maxYear: number | null;
  serviceIds: string[] | null;
  genres: string[] | null;
  excludedGenres: string[] | null;
  languages: string[] | null;
  excludedLanguages: string[] | null;
  minRuntime: number | null;
  maxRuntime: number | null;
  blindDate: boolean;
};

const DEFAULTS: DeckFilters = {
  forYou: true,
  mood: null,
  vibes: null,
  country: null,
  kinds: ['movie', 'tv'],
  minYear: null,
  maxYear: null,
  serviceIds: null,
  genres: null,
  excludedGenres: null,
  languages: null,
  excludedLanguages: null,
  minRuntime: null,
  maxRuntime: null,
  blindDate: false,
};

type State = DeckFilters & {
  setForYou: (on: boolean) => void;
  setMood: (m: MoodPreset | null) => void;
  setVibes: (v: VibePreset[] | null) => void;
  setCountry: (c: string | null) => void;
  toggleKind: (k: 'movie' | 'tv') => void;
  setYears: (min: number | null, max: number | null) => void;
  setServices: (services: string[] | null) => void;
  setGenres: (genres: string[] | null) => void;
  setExcludedGenres: (genres: string[] | null) => void;
  setLanguages: (languages: string[] | null) => void;
  setExcludedLanguages: (languages: string[] | null) => void;
  setRuntime: (min: number | null, max: number | null) => void;
  /** Apply a complete draft in one state update; never leave a half-applied deck. */
  apply: (filters: DeckFilters) => void;
  toggleBlindDate: () => void;
  reset: () => void;
};

/**
 * Filter sheet state (FSD section 3.9). Lives client-side; the deck composer
 * reads this on every refetch. Filters never persist server-side until the
 * user explicitly saves them as a preset (deferred).
 *
 * `forYou` is the default ranking mode. Manual selections are hard eligibility
 * rules in either mode; turning it off only changes ranking to a neutral deck.
 */
export const useDeckFilters = create<State>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setForYou: (forYou) => set({ forYou }),
      setMood: (mood) => set({ mood }),
      setVibes: (vibes) => set({ vibes }),
      setCountry: (country) => set({ country }),
      toggleKind: (k) =>
        set((s) => {
          const next = s.kinds.includes(k) ? s.kinds.filter((x) => x !== k) : [...s.kinds, k];
          return { kinds: next.length === 0 ? s.kinds : next };
        }),
      setYears: (minYear, maxYear) => set({ minYear, maxYear }),
      setServices: (serviceIds) => set({ serviceIds }),
      setGenres: (genres) => set({ genres }),
      setExcludedGenres: (excludedGenres) => set({ excludedGenres }),
      setLanguages: (languages) => set({ languages }),
      setExcludedLanguages: (excludedLanguages) => set({ excludedLanguages }),
      setRuntime: (minRuntime, maxRuntime) => set({ minRuntime, maxRuntime }),
      apply: (filters) => set(filters),
      toggleBlindDate: () => set((s) => ({ blindDate: !s.blindDate })),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'flixy.deck_filters.v2',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        forYou: state.forYou,
        mood: state.mood,
        vibes: state.vibes,
        country: state.country,
        kinds: state.kinds,
        minYear: state.minYear,
        maxYear: state.maxYear,
        serviceIds: state.serviceIds,
        genres: state.genres,
        excludedGenres: state.excludedGenres,
        languages: state.languages,
        excludedLanguages: state.excludedLanguages,
        minRuntime: state.minRuntime,
        maxRuntime: state.maxRuntime,
        blindDate: state.blindDate,
      }),
      migrate: (persisted, version) => {
        if (version < 2 && persisted && typeof persisted === 'object') {
          return { ...DEFAULTS, ...(persisted as Partial<DeckFilters>) };
        }
        return persisted as State;
      },
    },
  ),
);
