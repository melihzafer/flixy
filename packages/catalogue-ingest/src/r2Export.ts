import { gzipSync } from 'node:zlib';

import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ContentType, OfferType } from './types';

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2000;
const CHILD_LOOKUP_CHUNK_SIZE = 50;
const DEFAULT_UPLOAD_CONCURRENCY = 8;
const MAX_UPLOAD_CONCURRENCY = 32;

export type R2ExportTitleRow = {
  id: string;
  tmdb_id: number;
  content_type: ContentType;
  title: string;
  original_title: string | null;
  synopsis: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_key: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  content_rating: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  critic_score: number | null;
  popularity: number;
  genres: string[];
  language: string | null;
  is_adult: boolean;
  tagline: string | null;
  directors: string[];
  creators: string[];
  cast: string[];
  external_ids: Record<string, string | null>;
  tmdb_vote_average: number | null;
  awards: string | null;
  metadata_source: string;
  updated_at: string;
  ingested_at: string;
  last_ingested_at: string | null;
};

export type R2ExportAvailabilityRow = {
  title_id: string;
  service_id: string;
  region: string;
  offer_type: OfferType;
  deep_link: string | null;
  observed_at: string;
};

export type R2ExportVideoRow = {
  title_id: string;
  provider: string;
  video_key: string;
  video_type: string;
  site: string;
  official: boolean;
  language: string | null;
  region: string | null;
  published_at: string | null;
  observed_at: string;
};

export type R2TitleDocument = R2ExportTitleRow & {
  availability: R2ExportAvailabilityRow[];
  videos: R2ExportVideoRow[];
};

export type R2TitleIndexEntry = {
  id: string;
  tmdb_id: number;
  content_type: ContentType;
  title: string;
  release_year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  imdb_rating: number | null;
  popularity: number;
  genres: string[];
  language: string | null;
  is_adult: boolean;
  object_key: string;
};

type R2TitleIndexSource = Pick<
  R2ExportTitleRow,
  | 'id'
  | 'tmdb_id'
  | 'content_type'
  | 'title'
  | 'release_year'
  | 'poster_url'
  | 'backdrop_url'
  | 'imdb_rating'
  | 'popularity'
  | 'genres'
  | 'language'
  | 'is_adult'
>;

export type ExportCatalogueToR2Options = {
  supabase: SupabaseClient;
  s3: S3Client;
  bucket: string;
  prefix?: string;
  batchSize?: number;
  includeHidden?: boolean;
  includeAdult?: boolean;
  limit?: number;
  gzip?: boolean;
  uploadConcurrency?: number;
  startOffset?: number;
  objectsOnly?: boolean;
  indexOnly?: boolean;
  onProgress?: (progress: { titleCount: number; objectCount: number; batchCount: number }) => void;
};

export type ExportCatalogueToR2Result = {
  bucket: string;
  prefix: string;
  titleCount: number;
  objectCount: number;
  indexKey: string;
  manifestKey: string;
};

type ChildRowsByTitle = {
  availability: Map<string, R2ExportAvailabilityRow[]>;
  videos: Map<string, R2ExportVideoRow[]>;
};

const TITLE_EXPORT_COLUMNS = [
  'id',
  'tmdb_id',
  'content_type',
  'title',
  'original_title',
  'synopsis',
  'poster_url',
  'backdrop_url',
  'trailer_key',
  'release_year',
  'runtime_minutes',
  'content_rating',
  'imdb_rating',
  'imdb_votes',
  'critic_score',
  'popularity',
  'genres',
  'language',
  'is_adult',
  'tagline',
  'directors',
  'creators',
  'cast',
  'external_ids',
  'tmdb_vote_average',
  'awards',
  'metadata_source',
  'updated_at',
  'ingested_at',
  'last_ingested_at',
] as const;

const TITLE_INDEX_COLUMNS = [
  'id',
  'tmdb_id',
  'content_type',
  'title',
  'release_year',
  'poster_url',
  'backdrop_url',
  'imdb_rating',
  'popularity',
  'genres',
  'language',
  'is_adult',
] as const;

function chunks<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function normalizePrefix(prefix?: string) {
  return (prefix ?? 'catalogue').replace(/^\/+|\/+$/g, '');
}

function jsonExtension(gzip?: boolean) {
  return gzip === false ? 'json' : 'json.gz';
}

function objectKeyForTitle(
  prefix: string,
  title: Pick<R2ExportTitleRow, 'content_type' | 'tmdb_id'>,
  gzip?: boolean,
) {
  return `${prefix}/titles/${title.content_type}/${title.tmdb_id}.${jsonExtension(gzip)}`;
}

function indexKey(prefix: string, gzip?: boolean) {
  return `${prefix}/index/titles-index.${jsonExtension(gzip)}`;
}

function manifestKey(prefix: string) {
  return `${prefix}/manifest.json`;
}

function batchSize(input?: number) {
  if (!input) return DEFAULT_BATCH_SIZE;
  return Math.min(Math.max(input, 1), MAX_BATCH_SIZE);
}

function uploadConcurrency(input?: number) {
  if (!input) return DEFAULT_UPLOAD_CONCURRENCY;
  return Math.min(Math.max(input, 1), MAX_UPLOAD_CONCURRENCY);
}

async function runPool<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      const task = tasks[index];
      if (!task) continue;
      results[index] = await task();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

function toTitleIndexEntry(
  prefix: string,
  title: R2TitleIndexSource,
  gzip?: boolean,
): R2TitleIndexEntry {
  return {
    id: title.id,
    tmdb_id: title.tmdb_id,
    content_type: title.content_type,
    title: title.title,
    release_year: title.release_year,
    poster_url: title.poster_url,
    backdrop_url: title.backdrop_url,
    imdb_rating: title.imdb_rating,
    popularity: title.popularity,
    genres: title.genres,
    language: title.language,
    is_adult: title.is_adult,
    object_key: objectKeyForTitle(prefix, title, gzip),
  };
}

export function buildR2TitleDocument(input: {
  title: R2ExportTitleRow;
  availability?: R2ExportAvailabilityRow[];
  videos?: R2ExportVideoRow[];
}): R2TitleDocument {
  return {
    ...input.title,
    availability: input.availability ?? [],
    videos: input.videos ?? [],
  };
}

async function putJson(input: {
  s3: S3Client;
  bucket: string;
  key: string;
  body: unknown;
  gzip?: boolean;
}) {
  const json = JSON.stringify(input.body);
  await input.s3.send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.gzip === false ? json : gzipSync(Buffer.from(json, 'utf8')),
      ContentType: 'application/json',
      ContentEncoding: input.gzip === false ? undefined : 'gzip',
      CacheControl: 'public, max-age=3600',
    }),
  );
}

async function fetchChildRows(
  supabase: SupabaseClient,
  titleIds: string[],
): Promise<ChildRowsByTitle> {
  if (titleIds.length === 0) {
    return { availability: new Map(), videos: new Map() };
  }

  const availabilityRows: R2ExportAvailabilityRow[] = [];
  const videoRows: R2ExportVideoRow[] = [];

  for (const chunk of chunks(titleIds, CHILD_LOOKUP_CHUNK_SIZE)) {
    const [availabilityResult, videoResult] = await Promise.all([
      supabase
        .from('title_availability')
        .select('title_id,service_id,region,offer_type,deep_link,observed_at')
        .in('title_id', chunk),
      supabase
        .from('title_videos')
        .select(
          'title_id,provider,video_key,video_type,site,official,language,region,published_at,observed_at',
        )
        .in('title_id', chunk),
    ]);

    if (availabilityResult.error)
      throw new Error(`Fetching availability failed: ${availabilityResult.error.message}`);
    if (videoResult.error) throw new Error(`Fetching videos failed: ${videoResult.error.message}`);

    availabilityRows.push(...((availabilityResult.data ?? []) as R2ExportAvailabilityRow[]));
    videoRows.push(...((videoResult.data ?? []) as R2ExportVideoRow[]));
  }

  const availability = new Map<string, R2ExportAvailabilityRow[]>();
  for (const row of availabilityRows) {
    availability.set(row.title_id, [...(availability.get(row.title_id) ?? []), row]);
  }

  const videos = new Map<string, R2ExportVideoRow[]>();
  for (const row of videoRows) {
    videos.set(row.title_id, [...(videos.get(row.title_id) ?? []), row]);
  }

  return { availability, videos };
}

export async function exportCatalogueToR2(
  options: ExportCatalogueToR2Options,
): Promise<ExportCatalogueToR2Result> {
  if (options.objectsOnly && options.indexOnly) {
    throw new Error('R2 export cannot use objectsOnly and indexOnly together');
  }

  const prefix = normalizePrefix(options.prefix);
  const size = batchSize(options.batchSize);
  const concurrency = uploadConcurrency(options.uploadConcurrency);
  const index: R2TitleIndexEntry[] = [];
  const writeObjects = !options.indexOnly;
  const writeIndex = !options.objectsOnly;
  const selectedColumns = writeObjects ? TITLE_EXPORT_COLUMNS : TITLE_INDEX_COLUMNS;
  let offset = options.startOffset ?? 0;
  let objectCount = 0;
  let processedTitleCount = 0;

  while (true) {
    const remaining = options.limit ? options.limit - processedTitleCount : undefined;
    if (remaining !== undefined && remaining <= 0) break;
    const currentBatchSize = Math.min(size, remaining ?? size);

    let query = options.supabase
      .from('titles')
      .select(selectedColumns.join(','))
      .order('popularity', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + currentBatchSize - 1);

    if (!options.includeHidden) query = query.eq('is_hidden', false);
    if (!options.includeAdult) query = query.eq('is_adult', false);

    const { data, error } = await query;
    if (error) throw new Error(`Fetching titles failed: ${error.message}`);
    const titleRows = (data ?? []) as unknown as R2TitleIndexSource[];
    if (titleRows.length === 0) break;

    processedTitleCount += titleRows.length;

    if (!writeObjects) {
      index.push(...titleRows.map((title) => toTitleIndexEntry(prefix, title, options.gzip)));
      options.onProgress?.({
        titleCount: processedTitleCount,
        objectCount,
        batchCount: titleRows.length,
      });
      offset += titleRows.length;
      if (titleRows.length < currentBatchSize) break;
      continue;
    }

    const titles = titleRows as R2ExportTitleRow[];

    const children = await fetchChildRows(
      options.supabase,
      titles.map((title) => title.id),
    );

    const batchIndex = await runPool(
      titles.map((title) => async () => {
        const key = objectKeyForTitle(prefix, title, options.gzip);
        await putJson({
          s3: options.s3,
          bucket: options.bucket,
          key,
          body: buildR2TitleDocument({
            title,
            availability: children.availability.get(title.id),
            videos: children.videos.get(title.id),
          }),
          gzip: options.gzip,
        });
        return toTitleIndexEntry(prefix, title, options.gzip);
      }),
      concurrency,
    );
    if (writeIndex) index.push(...batchIndex);
    objectCount += batchIndex.length;
    options.onProgress?.({
      titleCount: processedTitleCount,
      objectCount,
      batchCount: batchIndex.length,
    });

    offset += titles.length;
    if (titles.length < currentBatchSize) break;
  }

  const titleIndexKey = indexKey(prefix, options.gzip);
  const titleManifestKey = manifestKey(prefix);
  if (writeIndex) {
    await putJson({
      s3: options.s3,
      bucket: options.bucket,
      key: titleIndexKey,
      body: index,
      gzip: options.gzip,
    });
    objectCount += 1;
  }

  if (writeIndex) {
    await putJson({
      s3: options.s3,
      bucket: options.bucket,
      key: titleManifestKey,
      body: {
        exported_at: new Date().toISOString(),
        title_count: index.length,
        index_key: titleIndexKey,
        object_prefix: `${prefix}/titles`,
        gzip: options.gzip !== false,
      },
      gzip: false,
    });
    objectCount += 1;
  }

  return {
    bucket: options.bucket,
    prefix,
    titleCount: processedTitleCount,
    objectCount,
    indexKey: titleIndexKey,
    manifestKey: titleManifestKey,
  };
}
