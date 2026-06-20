import type { SupabaseClient } from '@supabase/supabase-js';

import { getCachedTmdbResponse, setCachedTmdbResponse } from './cache';
import {
  type TmdbMovieDetail,
  type TmdbTvDetail,
  mapTmdbTitleDetail,
  mergeIngestPlans,
} from './mapper';
import { upsertIngestPlan } from './supabaseWriter';
import type { TmdbClient } from './tmdbClient';
import {
  CONTENT_TYPES,
  type CandidateRef,
  type CandidateSource,
  type ContentType,
  type IngestWriteSummary,
} from './types';

export type RunCatalogueIngestionOptions = {
  supabase: SupabaseClient;
  tmdb: TmdbClient;
  regions?: string[];
  kinds?: ContentType[];
  language?: string;
  limitPerRegionKind?: number;
  explicitTitles?: Array<{ kind: ContentType; tmdbId: number }>;
  dryRun?: boolean;
  cacheTtlHours?: number;
  useCache?: boolean;
  sources?: CandidateSource[];
  batchId?: string;
  ingestionSource?: 'backfill' | 'changes' | 'trending';
};

export type CatalogueIngestionResult = IngestWriteSummary & {
  regions: string[];
  kinds: ContentType[];
};

function normalizeRegions(regions: string[] | undefined): string[] {
  const normalized = (regions && regions.length > 0 ? regions : ['US'])
    .map((region) => region.trim().toUpperCase())
    .filter(Boolean);
  for (const region of normalized) {
    if (!/^[A-Z]{2}$/.test(region)) throw new Error(`Invalid region "${region}"`);
  }
  return Array.from(new Set(normalized));
}

function normalizeKinds(kinds: ContentType[] | undefined): ContentType[] {
  const normalized = kinds && kinds.length > 0 ? kinds : [...CONTENT_TYPES];
  for (const kind of normalized) {
    if (!CONTENT_TYPES.includes(kind)) throw new Error(`Invalid content type "${kind}"`);
  }
  return Array.from(new Set(normalized));
}

function cacheKey(kind: ContentType, tmdbId: number, language: string): string {
  return `tmdb:${kind}:${tmdbId}:detail:v1:${language}`;
}

async function getDetail(input: {
  supabase: SupabaseClient;
  tmdb: TmdbClient;
  kind: ContentType;
  tmdbId: number;
  language: string;
  useCache: boolean;
  cacheTtlHours: number;
}): Promise<TmdbMovieDetail | TmdbTvDetail> {
  const key = cacheKey(input.kind, input.tmdbId, input.language);
  if (input.useCache) {
    const cached = await getCachedTmdbResponse<TmdbMovieDetail | TmdbTvDetail>(input.supabase, key);
    if (cached) return cached;
  }

  const detail = (await input.tmdb.getTitleDetail({
    kind: input.kind,
    tmdbId: input.tmdbId,
    language: input.language,
  })) as TmdbMovieDetail | TmdbTvDetail;

  if (input.useCache) {
    await setCachedTmdbResponse({
      supabase: input.supabase,
      cacheKey: key,
      response: detail,
      ttlHours: input.cacheTtlHours,
    });
  }
  return detail;
}

export async function runCatalogueIngestion(
  options: RunCatalogueIngestionOptions,
): Promise<CatalogueIngestionResult> {
  const regions = normalizeRegions(options.regions);
  const kinds = normalizeKinds(options.kinds);
  const language = options.language ?? 'en-US';
  const limit = options.limitPerRegionKind ?? 40;
  const cacheTtlHours = options.cacheTtlHours ?? 24;
  const useCache = options.useCache ?? true;
  const candidates = new Map<string, CandidateRef>();

  if (options.explicitTitles && options.explicitTitles.length > 0) {
    const region = regions[0] ?? 'US';
    for (const title of options.explicitTitles) {
      candidates.set(`${title.kind}:${title.tmdbId}`, {
        kind: title.kind,
        tmdbId: title.tmdbId,
        region,
        source: 'explicit',
      });
    }
  } else {
    for (const region of regions) {
      for (const kind of kinds) {
        const refs = await options.tmdb.listCandidates({
          kind,
          region,
          language,
          limit,
          sources: options.sources,
        });
        for (const ref of refs) candidates.set(`${ref.kind}:${ref.tmdbId}`, ref);
      }
    }
  }

  const now = new Date().toISOString();
  const plans = [];
  for (const candidate of candidates.values()) {
    const detail = await getDetail({
      supabase: options.supabase,
      tmdb: options.tmdb,
      kind: candidate.kind,
      tmdbId: candidate.tmdbId,
      language,
      useCache,
      cacheTtlHours,
    });
    plans.push(
      mapTmdbTitleDetail({
        item:
          candidate.kind === 'movie'
            ? { kind: 'movie', detail: detail as TmdbMovieDetail }
            : { kind: 'tv', detail: detail as TmdbTvDetail },
        regions,
        observedAt: now,
      }),
    );
  }

  const plan = mergeIngestPlans(plans);
  const summary = await upsertIngestPlan({
    supabase: options.supabase,
    plan,
    candidateCount: candidates.size,
    dryRun: options.dryRun,
    batchId: options.batchId,
    ingestionSource: options.ingestionSource,
  });

  return {
    ...summary,
    regions,
    kinds,
  };
}
