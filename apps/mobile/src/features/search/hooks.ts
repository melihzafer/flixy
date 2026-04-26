import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { type Title, TitleSchema } from '@flixy/shared';

import { supabase } from '../../lib/supabase';

/**
 * Search hook (FSD section 3.10). MVP uses Postgres ILIKE on title +
 * original_title with popularity tiebreaker. Real FTS / typo tolerance is a
 * follow-up (server-side `tsvector` index documented in DECISIONS.md).
 */

const TitleRowSchema = z.object({
  id: z.string().uuid(),
  tmdb_id: z.number(),
  content_type: z.enum(['movie', 'tv']),
  title: z.string(),
  original_title: z.string().nullable(),
  synopsis: z.string().nullable(),
  poster_url: z.string().nullable(),
  backdrop_url: z.string().nullable(),
  trailer_key: z.string().nullable(),
  release_year: z.number().nullable(),
  runtime_minutes: z.number().nullable(),
  imdb_rating: z.union([z.number(), z.string()]).nullable(),
  popularity: z.union([z.number(), z.string()]),
  genres: z.array(z.string()),
  language: z.string().nullable(),
});

function toNum(v: number | string): number {
  return typeof v === 'string' ? Number.parseFloat(v) : v;
}

function rowToTitle(row: z.infer<typeof TitleRowSchema>): Title {
  return TitleSchema.parse({
    id: row.id,
    tmdbId: row.tmdb_id,
    kind: row.content_type,
    title: row.title,
    originalTitle: row.original_title,
    overview: row.synopsis,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    trailerKey: row.trailer_key,
    releaseYear: row.release_year,
    runtimeMinutes: row.runtime_minutes,
    imdbRating: row.imdb_rating == null ? null : toNum(row.imdb_rating),
    popularity: toNum(row.popularity),
    genres: row.genres,
    language: row.language,
    availability: [],
  });
}

export function useSearchTitles(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['search', trimmed],
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const safe = trimmed.replace(/[%_]/g, '\\$&');
      const pattern = `%${safe}%`;
      const { data, error } = await supabase
        .from('titles')
        .select('*')
        .or(`title.ilike.${pattern},original_title.ilike.${pattern}`)
        .order('popularity', { ascending: false })
        .limit(40);
      if (error) throw error;
      return z
        .array(TitleRowSchema)
        .parse(data ?? [])
        .map(rowToTitle);
    },
  });
}
