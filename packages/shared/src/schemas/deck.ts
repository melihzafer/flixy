import { z } from 'zod';

import { TitleSchema } from './title';

/**
 * A scored deck candidate plus the rule trace explaining why it landed in the
 * deck (FSD section 3.5.2). Rule trace is for analytics + debugging; not
 * surfaced in the UI directly.
 */
export const RuleTraceSchema = z.object({
  personalization: z.number(),
  popularity: z.number(),
  availability: z.number(),
  freshness: z.number(),
  cooldown: z.number(),
  exploration: z.boolean().default(false),
  finalScore: z.number(),
});
export type RuleTrace = z.infer<typeof RuleTraceSchema>;

export const DeckCardSchema = z.object({
  title: TitleSchema,
  trace: RuleTraceSchema,
});
export type DeckCard = z.infer<typeof DeckCardSchema>;

export const DeckSchema = z.object({
  sessionId: z.string().uuid(),
  generatedAt: z.string(),
  cards: z.array(DeckCardSchema),
  isNarrow: z.boolean(),
});
export type Deck = z.infer<typeof DeckSchema>;

/**
 * Mood presets (FSD section 3.5.4): mood = filter set, not a separate algorithm.
 * A mood is a single-select shortcut that bundles a genre cluster and optional
 * runtime/year bounds. Surfaced as a single-select row in the filter sheet.
 */
export const MoodPresetSchema = z.enum([
  'cozy',
  'edge_of_seat',
  'mind_bender',
  'feel_good',
  'short_pick',
  'classic',
  'dark',
  'romantic',
  'epic',
  'chill',
]);
export type MoodPreset = z.infer<typeof MoodPresetSchema>;

export type MoodFilter = {
  genres?: string[];
  maxRuntime?: number;
  minYear?: number;
  maxYear?: number;
};

export const MOOD_PRESETS: Record<MoodPreset, MoodFilter> = {
  cozy: { genres: ['comedy', 'romance', 'family'], maxRuntime: 110 },
  edge_of_seat: { genres: ['thriller', 'horror', 'action'] },
  mind_bender: { genres: ['sci_fi', 'mystery', 'thriller'] },
  feel_good: { genres: ['comedy', 'romance', 'animation', 'family'] },
  short_pick: { maxRuntime: 95 },
  classic: { maxYear: 2000 },
  dark: { genres: ['horror', 'thriller', 'crime'] },
  romantic: { genres: ['romance', 'drama', 'comedy'] },
  epic: { genres: ['action', 'adventure', 'fantasy', 'sci_fi'] },
  chill: { genres: ['comedy', 'documentary', 'family'], maxRuntime: 105 },
};

/**
 * Vibes (FSD 3.5.4 extension): a multi-select tonal layer that sits on top of
 * moods. Each vibe maps to a genre cluster; a candidate matches a vibe when it
 * carries at least one of the vibe's genres. The composer boosts titles that
 * match any selected vibe. Surfaced as a multi-select row in the filter sheet.
 */
export const VibePresetSchema = z.enum([
  'dark',
  'wholesome',
  'intense',
  'slow_burn',
  'feel_good',
  'mind_bending',
  'nostalgic',
  'epic',
  'offbeat',
  'emotional',
  'funny',
  'surreal',
]);
export type VibePreset = z.infer<typeof VibePresetSchema>;

export type VibeFilter = {
  genres?: string[];
  maxRuntime?: number;
  minYear?: number;
  maxYear?: number;
};

export const VIBE_PRESETS: Record<VibePreset, VibeFilter> = {
  dark: { genres: ['horror', 'thriller', 'crime'] },
  wholesome: { genres: ['family', 'animation', 'comedy'] },
  intense: { genres: ['action', 'thriller', 'horror'] },
  slow_burn: { genres: ['drama', 'mystery'] },
  feel_good: { genres: ['comedy', 'romance', 'family', 'animation'] },
  mind_bending: { genres: ['sci_fi', 'mystery', 'thriller'] },
  nostalgic: { maxYear: 2010 },
  epic: { genres: ['action', 'adventure', 'fantasy', 'sci_fi'] },
  offbeat: { genres: ['comedy', 'documentary'] },
  emotional: { genres: ['drama', 'romance', 'family'] },
  funny: { genres: ['comedy'] },
  surreal: { genres: ['sci_fi', 'fantasy', 'mystery'] },
};

/**
 * Resolve a vibe preset into its concrete filter. Returns an empty object when
 * the vibe is unknown so callers can spread it safely.
 */
export function vibeToFilter(vibe: VibePreset | null): VibeFilter {
  if (!vibe) return {};
  return VIBE_PRESETS[vibe] ?? {};
}

/**
 * Aggregate genres from a set of selected vibes. Used by the deck hook to
 * build a TMDB `with_genres` OR-match for vibe filtering.
 */
export function vibesToGenres(vibes: readonly VibePreset[] | null): string[] | null {
  if (!vibes || vibes.length === 0) return null;
  const set = new Set<string>();
  for (const v of vibes) {
    const filter = VIBE_PRESETS[v];
    if (filter?.genres) {
      for (const g of filter.genres) set.add(g);
    }
  }
  return set.size > 0 ? Array.from(set) : null;
}
