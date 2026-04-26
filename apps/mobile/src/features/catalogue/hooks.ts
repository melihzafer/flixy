import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { type Title, TitleSchema } from '@flixy/shared';

import { supabase } from '../../lib/supabase';

/**
 * Catalogue read APIs (FSD section 3.4). The mobile client never writes to
 * `titles` or `title_availability`; ingestion happens server-side via
 * Trigger.dev jobs (out of scope for the mobile PR; see lib/tmdb.ts stub).
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

const AvailabilityRowSchema = z.object({
  title_id: z.string().uuid(),
  service_id: z.string(),
  region: z.string().length(2),
  offer_type: z.enum(['subscription', 'rent', 'buy', 'free']),
  deep_link: z.string().nullable(),
  observed_at: z.string(),
});

type TitleRow = z.infer<typeof TitleRowSchema>;
type AvailabilityRow = z.infer<typeof AvailabilityRowSchema>;

function toNum(v: number | string): number {
  return typeof v === 'string' ? Number.parseFloat(v) : v;
}

function rowToTitle(row: TitleRow, availability: AvailabilityRow[] = []): Title {
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
    availability: availability.map((a) => ({
      serviceId: a.service_id,
      region: a.region,
      offerType: a.offer_type,
      deepLink: a.deep_link,
      observedAt: a.observed_at,
    })),
  });
}

export function useTitle(id: string | null | undefined) {
  return useQuery({
    queryKey: ['title', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const [{ data: row, error }, { data: avail, error: aErr }] = await Promise.all([
        supabase.from('titles').select('*').eq('id', id).single(),
        supabase.from('title_availability').select('*').eq('title_id', id),
      ]);
      if (error) throw error;
      if (aErr) throw aErr;
      return rowToTitle(
        TitleRowSchema.parse(row),
        z.array(AvailabilityRowSchema).parse(avail ?? []),
      );
    },
  });
}

export function useTitlesByIds(ids: string[]) {
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: ['titles', 'byIds', sorted.join(',')],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('titles').select('*').in('id', sorted);
      if (error) throw error;
      return z
        .array(TitleRowSchema)
        .parse(data ?? [])
        .map((r) => rowToTitle(r));
    },
  });
}

export type TitleQueryFilter = {
  region?: string;
  serviceIds?: string[];
  genres?: string[];
  kinds?: ('movie' | 'tv')[];
  minYear?: number;
  maxYear?: number;
  limit?: number;
};

/**
 * Region-aware deck candidate query. The recommendation/deck composer (FSD
 * section 3.5) wraps this with the 7-layer scoring; here we only filter +
 * popularity-sort.
 */
export function useTitlesQuery(filter: TitleQueryFilter) {
  const key = JSON.stringify(filter);
  return useQuery({
    queryKey: ['titles', 'query', key],
    queryFn: async () => {
      let q = supabase.from('titles').select('*').order('popularity', { ascending: false });
      if (filter.kinds && filter.kinds.length > 0) q = q.in('content_type', filter.kinds);
      if (filter.genres && filter.genres.length > 0) q = q.overlaps('genres', filter.genres);
      if (filter.minYear != null) q = q.gte('release_year', filter.minYear);
      if (filter.maxYear != null) q = q.lte('release_year', filter.maxYear);
      q = q.limit(filter.limit ?? 60);
      const { data, error } = await q;
      if (error) throw error;
      const rows = z.array(TitleRowSchema).parse(data ?? []);
      if (rows.length === 0) return [];

      let availByTitle: Map<string, AvailabilityRow[]> = new Map();
      if (filter.region) {
        const ids = rows.map((r) => r.id);
        const { data: aData, error: aErr } = await supabase
          .from('title_availability')
          .select('*')
          .in('title_id', ids)
          .eq('region', filter.region);
        if (aErr) throw aErr;
        const parsed = z.array(AvailabilityRowSchema).parse(aData ?? []);
        availByTitle = parsed.reduce((m, a) => {
          const arr = m.get(a.title_id) ?? [];
          arr.push(a);
          m.set(a.title_id, arr);
          return m;
        }, new Map<string, AvailabilityRow[]>());

        if (filter.serviceIds && filter.serviceIds.length > 0) {
          const allowed = new Set(filter.serviceIds);
          return rows
            .map((r) => rowToTitle(r, availByTitle.get(r.id) ?? []))
            .filter((t) => t.availability.some((a) => allowed.has(a.serviceId)));
        }
      }

      return rows.map((r) => rowToTitle(r, availByTitle.get(r.id) ?? []));
    },
  });
}
