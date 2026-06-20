import { create } from 'zustand';

import type { MoodPreset } from '@flixy/shared';

export type DeckFilters = {
  mood: MoodPreset | null;
  kinds: ('movie' | 'tv')[];
  minYear: number | null;
  maxYear: number | null;
  serviceIds: string[] | null;
  genres: string[] | null;
};

const DEFAULTS: DeckFilters = {
  mood: null,
  kinds: ['movie', 'tv'],
  minYear: null,
  maxYear: null,
  serviceIds: null,
  genres: null,
};

type State = DeckFilters & {
  setMood: (m: MoodPreset | null) => void;
  toggleKind: (k: 'movie' | 'tv') => void;
  setYears: (min: number | null, max: number | null) => void;
  setServices: (services: string[] | null) => void;
  setGenres: (genres: string[] | null) => void;
  reset: () => void;
};

/**
 * Filter sheet state (FSD section 3.9). Lives client-side; the deck composer
 * reads this on every refetch. Filters never persist server-side until the
 * user explicitly saves them as a preset (deferred).
 */
export const useDeckFilters = create<State>((set) => ({
  ...DEFAULTS,
  setMood: (mood) => set({ mood }),
  toggleKind: (k) =>
    set((s) => {
      const next = s.kinds.includes(k) ? s.kinds.filter((x) => x !== k) : [...s.kinds, k];
      return { kinds: next.length === 0 ? s.kinds : next };
    }),
  setYears: (minYear, maxYear) => set({ minYear, maxYear }),
  setServices: (serviceIds) => set({ serviceIds }),
  setGenres: (genres) => set({ genres }),
  reset: () => set(DEFAULTS),
}));
