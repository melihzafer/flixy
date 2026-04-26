import { z } from 'zod';

import { LanguageCodeSchema, RegionCodeSchema } from './user';

/**
 * Onboarding state shared between mobile + (future) edge handlers.
 * Mirrors the shape of `public.user_preferences` after camelCase mapping.
 */

export const StreamingServiceIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase snake_case ids.');

export const GenreIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase snake_case ids.');

export const StreamingServiceSchema = z.object({
  id: StreamingServiceIdSchema,
  name: z.string().min(1),
  logoUrl: z.string().url().nullable(),
  regions: z.array(RegionCodeSchema),
  displayRank: z.number().int().nonnegative(),
});
export type StreamingService = z.infer<typeof StreamingServiceSchema>;

export const GenreSchema = z.object({
  id: GenreIdSchema,
  displayRank: z.number().int().nonnegative(),
});
export type Genre = z.infer<typeof GenreSchema>;

/** Min/max bounds from FSD § 3.2.3. */
export const ONBOARDING = {
  MIN_SERVICES: 1,
  MIN_GENRES: 3,
  MAX_GENRES: 12,
  COLD_START_CARDS: 10,
} as const;

export const UserPreferencesSchema = z.object({
  userId: z.string().uuid(),
  region: RegionCodeSchema,
  language: LanguageCodeSchema,
  selectedServices: z.array(StreamingServiceIdSchema),
  selectedGenres: z.array(GenreIdSchema),
  notificationsEnabled: z.boolean(),
  onboardingCompletedAt: z.string().nullable(),
  coldStartCompletedAt: z.string().nullable(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const OnboardingServicesInputSchema = z.object({
  selectedServices: z.array(StreamingServiceIdSchema).min(ONBOARDING.MIN_SERVICES),
});

export const OnboardingGenresInputSchema = z.object({
  selectedGenres: z
    .array(GenreIdSchema)
    .min(ONBOARDING.MIN_GENRES, `Pick at least ${ONBOARDING.MIN_GENRES} genres.`)
    .max(ONBOARDING.MAX_GENRES, `Pick at most ${ONBOARDING.MAX_GENRES} genres.`),
});

export const OnboardingRegionInputSchema = z.object({
  region: RegionCodeSchema,
  language: LanguageCodeSchema,
});

export type OnboardingServicesInput = z.infer<typeof OnboardingServicesInputSchema>;
export type OnboardingGenresInput = z.infer<typeof OnboardingGenresInputSchema>;
export type OnboardingRegionInput = z.infer<typeof OnboardingRegionInputSchema>;
