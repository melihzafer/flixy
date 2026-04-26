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
 */
export const MoodPresetSchema = z.enum([
  'cozy',
  'edge_of_seat',
  'mind_bender',
  'feel_good',
  'short_pick',
  'classic',
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
};
