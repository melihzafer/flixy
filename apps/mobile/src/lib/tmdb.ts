/**
 * TMDB ingestion adapter — server-side only stub.
 *
 * Real ingestion happens in Trigger.dev jobs (see FSD section 3.4.4) using the
 * service-role Supabase key. The mobile client never calls TMDB directly:
 * - leaks API keys into the bundle
 * - bypasses our admin overrides (`is_hidden`, `is_adult`)
 * - duplicates the localized `synopsis` fallback logic
 *
 * This file documents the integration surface so the future Trigger.dev worker
 * has a typed contract to land against. It is not imported by app code.
 */

import { z } from 'zod';

export const TmdbMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  release_date: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(),
  vote_average: z.number().nullable().optional(),
  popularity: z.number(),
  genre_ids: z.array(z.number()).optional(),
  adult: z.boolean().optional(),
  original_language: z.string().optional(),
});

export type TmdbMovie = z.infer<typeof TmdbMovieSchema>;

/**
 * Placeholder. Implement in the Trigger.dev worker; do NOT call from the app.
 * @internal
 */
export async function ingestTmdbPopular(_region: string): Promise<void> {
  throw new Error('ingestTmdbPopular runs server-side only (Trigger.dev). See FSD 3.4.4.');
}
