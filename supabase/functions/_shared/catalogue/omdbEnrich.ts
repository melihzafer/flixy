// OMDb enrichment pass. Runs *after* the TMDB ingester has populated
// public.titles. Selects titles whose external_ids contain an imdb_id
// and whose omdb_enriched_at is older than the configured staleness
// threshold (or null), then writes IMDb rating + votes + awards back.
//
// Designed for the free tier:
//   * caps batch size per run (DEFAULT 100)
//   * skips re-enrichment for OMDB_REENRICH_DAYS (default 30)
//   * caches each lookup in tmdb_ingest_cache for OMDB_CACHE_TTL_HOURS
//     (default 720h = 30 days)

import type { SupabaseClient } from '@supabase/supabase-js';

import { getCachedTmdbResponse, setCachedTmdbResponse } from './cache.ts';
import type { OmdbClient, OmdbDetail } from './omdbClient.ts';

export type EnrichOmdbOptions = {
  supabase: SupabaseClient;
  omdb: OmdbClient;
  batchSize?: number;
  reenrichAfterDays?: number;
  cacheTtlHours?: number;
  dryRun?: boolean;
};

export type EnrichOmdbSummary = {
  dryRun: boolean;
  candidateCount: number;
  enrichedCount: number;
  skippedCount: number;
  errorCount: number;
};

type CandidateRow = {
  id: string;
  external_ids: Record<string, string | null>;
};

function parseImdbVotes(votes: string | null): number | null {
  if (!votes) return null;
  const numeric = Number.parseInt(votes.replace(/[,\s]/g, ''), 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function parseImdbRating(rating: string | null): number | null {
  if (!rating) return null;
  const numeric = Number.parseFloat(rating);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0 || numeric > 10) return null;
  return Math.round(numeric * 10) / 10;
}

function omdbCacheKey(imdbId: string): string {
  return `omdb:title:${imdbId}:v1`;
}

export async function enrichWithOmdb(options: EnrichOmdbOptions): Promise<EnrichOmdbSummary> {
  const batchSize = options.batchSize ?? 100;
  const reenrichDays = options.reenrichAfterDays ?? 30;
  const cacheTtlHours = options.cacheTtlHours ?? 24 * 30;
  const dryRun = options.dryRun ?? false;
  const cutoffIso = new Date(Date.now() - reenrichDays * 24 * 60 * 60 * 1000).toISOString();

  // Pull candidates: have external_ids.imdb_id, and either never enriched
  // or last enriched before the cutoff. We can't easily filter on JSONB
  // imdb_id presence in PostgREST, so we filter in code after fetching.
  const { data: rows, error } = await options.supabase
    .from('titles')
    .select('id, external_ids, omdb_enriched_at')
    .or(`omdb_enriched_at.is.null,omdb_enriched_at.lt.${cutoffIso}`)
    .order('popularity', { ascending: false })
    .limit(batchSize * 4);
  if (error) throw new Error(`OMDb candidate query failed: ${error.message}`);

  const candidates: CandidateRow[] = (rows ?? [])
    .map((row) => ({
      id: row.id as string,
      external_ids: (row.external_ids ?? {}) as Record<string, string | null>,
    }))
    .filter((row) => {
      const imdbId = row.external_ids?.imdb_id;
      return typeof imdbId === 'string' && /^tt\d{6,}$/.test(imdbId);
    })
    .slice(0, batchSize);

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of candidates) {
    const imdbId = row.external_ids.imdb_id as string;
    let detail: OmdbDetail | null = null;
    try {
      const cached = await getCachedTmdbResponse<OmdbDetail | null>(
        options.supabase,
        omdbCacheKey(imdbId),
      );
      if (cached) {
        detail = cached;
      } else {
        detail = await options.omdb.getByImdbId(imdbId);
        await setCachedTmdbResponse({
          supabase: options.supabase,
          cacheKey: omdbCacheKey(imdbId),
          response: detail,
          ttlHours: cacheTtlHours,
        });
      }
    } catch {
      errors += 1;
      continue;
    }

    if (!detail) {
      skipped += 1;
      continue;
    }

    const updates = {
      imdb_rating: parseImdbRating(detail.imdbRating),
      imdb_votes: parseImdbVotes(detail.imdbVotes),
      awards: detail.awards,
      omdb_enriched_at: new Date().toISOString(),
    };

    if (dryRun) {
      enriched += 1;
      continue;
    }

    const { error: updateError } = await options.supabase
      .from('titles')
      .update(updates)
      .eq('id', row.id);
    if (updateError) {
      errors += 1;
    } else {
      enriched += 1;
    }
  }

  return {
    dryRun,
    candidateCount: candidates.length,
    enrichedCount: enriched,
    skippedCount: skipped,
    errorCount: errors,
  };
}
