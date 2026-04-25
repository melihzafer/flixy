import { z } from 'zod';

export const TitleKindSchema = z.enum(['movie', 'tv']);

export const TitleSchema = z.object({
  id: z.string(),
  tmdbId: z.number().int().positive(),
  kind: TitleKindSchema,
  title: z.string(),
  originalTitle: z.string(),
  overview: z.string().nullable(),
  posterUrl: z.string().url().nullable(),
  backdropUrl: z.string().url().nullable(),
  releaseYear: z.number().int().min(1880).max(2100).nullable(),
  runtimeMinutes: z.number().int().positive().nullable(),
  genres: z.array(z.string()),
});

export type Title = z.infer<typeof TitleSchema>;
export type TitleKind = z.infer<typeof TitleKindSchema>;
