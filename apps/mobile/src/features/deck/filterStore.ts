import { create } from 'zustand';

import type { MoodPreset, VibePreset } from '@flixy/shared';

export type DeckFilters = {
  /** "For You" mode: ignore manual filters; lean on taste + remote recos. Selected by default. */
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
  blindDate: boolean; // <-- NEW
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
  blindDate: false, // <-- NEW
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
  toggleBlindDate: () => void; // <-- NEW
  reset: () => void;
};

/**
 * Filter sheet state (FSD section 3.9). Lives client-side; the deck composer
 * reads this on every refetch. Filters never persist server-side until the
 * user explicitly saves them as a preset (deferred).
 *
 * `forYou` is the default mode: the deck leans on the user's taste signal +
 * remote recommendations instead of the manual selections below. Picking any
 * manual filter (mood, vibe, country, year range, services, genres) flips
 * `forYou` off so the manual selection takes effect.
 */
export const useDeckFilters = create<State>((set) => ({
  ...DEFAULTS,
  setForYou: (forYou) => set({ forYou }),
  setMood: (mood) => set({ mood, forYou: false }),
  setVibes: (vibes) => set({ vibes, forYou: false }),
  setCountry: (country) => set({ country, forYou: false }),
  toggleKind: (k) =>
    set((s) => {
      const next = s.kinds.includes(k) ? s.kinds.filter((x) => x !== k) : [...s.kinds, k];
      return { kinds: next.length === 0 ? s.kinds : next, forYou: false };
    }),
  setYears: (minYear, maxYear) => set({ minYear, maxYear, forYou: false }),
  setServices: (serviceIds) => set({ serviceIds, forYou: false }),
  setGenres: (genres) => set({ genres, forYou: false }),
  toggleBlindDate: () => set((s) => ({ blindDate: !s.blindDate })), // <-- NEW
  reset: () => set(DEFAULTS),
}));
