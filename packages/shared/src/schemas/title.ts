import { z } from 'zod';

export const TitleKindSchema = z.enum(['movie', 'tv']);

export const OfferTypeSchema = z.enum(['subscription', 'rent', 'buy', 'free']);

export const TitleAvailabilitySchema = z.object({
  serviceId: z.string(),
  region: z.string().length(2),
  offerType: OfferTypeSchema,
  deepLink: z.string().nullable(),
  observedAt: z.string(),
});

export const TitleSchema = z.object({
  id: z.string().uuid(),
  tmdbId: z.number().int().positive(),
  kind: TitleKindSchema,
  title: z.string(),
  originalTitle: z.string().nullable(),
  overview: z.string().nullable(),
  posterUrl: z.string().url().nullable(),
  backdropUrl: z.string().url().nullable(),
  trailerKey: z.string().nullable(),
  releaseYear: z.number().int().min(1880).max(2100).nullable(),
  runtimeMinutes: z.number().int().positive().nullable(),
  contentRating: z.string().min(1).nullable().optional(),
  imdbRating: z.number().min(0).max(10).nullable(),
  criticScore: z.number().int().min(0).max(100).nullable().optional(),
  popularity: z.number(),
  genres: z.array(z.string()),
  language: z.string().nullable(),
  tagline: z.string().min(1).nullable().optional(),
  directors: z.array(z.string().min(1)).optional(),
  creators: z.array(z.string().min(1)).optional(),
  cast: z.array(z.string().min(1)).optional(),
  availability: z.array(TitleAvailabilitySchema).default([]),
});

export type Title = z.infer<typeof TitleSchema>;
export type TitleKind = z.infer<typeof TitleKindSchema>;
export type TitleAvailability = z.infer<typeof TitleAvailabilitySchema>;
export type OfferType = z.infer<typeof OfferTypeSchema>;
