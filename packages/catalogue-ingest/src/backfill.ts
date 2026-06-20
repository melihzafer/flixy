import type { SupabaseClient } from '@supabase/supabase-js';

import { runCatalogueIngestion } from './ingest';
import type { TmdbClient } from './tmdbClient';
import {
  CONTENT_TYPES,
  type CatalogueBackfillCursor,
  type CatalogueBackfillJob,
  type CatalogueBackfillStepResult,
  type ContentType,
} from './types';

const DEFAULT_REGIONS = ['US', 'TR', 'BG', 'ES', 'DE', 'FR', 'BR'];
const DEFAULT_BATCH_SIZE = 250;
const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_MAX_SECONDS = 80;

export type StartCatalogueBackfillJobOptions = {
  supabase: SupabaseClient;
  tmdb: TmdbClient;
  kind: ContentType;
  regions?: string[];
  language?: string;
  snapshotDate?: string;
  batchSize?: number;
  includeAdult?: boolean;
  includeUnreleased?: boolean;
  maxCandidates?: number;
};

export type ProcessCatalogueBackfillStepOptions = {
  supabase: SupabaseClient;
  tmdb: TmdbClient;
  jobId?: string;
  kind?: ContentType;
  regions?: string[];
  language?: string;
  snapshotDate?: string;
  batchSize?: number;
  dryRun?: boolean;
  includeAdult?: boolean;
  includeUnreleased?: boolean;
  maxCandidates?: number;
  maxSeconds?: number;
  autoStart?: boolean;
  useCache?: boolean;
};

type BatchRow = { id: string };
type CandidateRow = { tmdb_id: number; popularity: number | string | null; adult: boolean | null };

const CANDIDATE_CHUNK_SIZE = 10000;

function normalizeRegions(regions: string[] | undefined): string[] {
  const normalized = (regions && regions.length > 0 ? regions : DEFAULT_REGIONS)
    .map((region) => region.trim().toUpperCase())
    .filter(Boolean);
  for (const region of normalized) {
    if (!/^[A-Z]{2}$/.test(region)) throw new Error(`Invalid region "${region}"`);
  }
  return Array.from(new Set(normalized));
}

function normalizeBatchSize(value: number | undefined): number {
  if (value == null) return DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(value) || value < 1)
    throw new Error('batch size must be a positive integer');
  return Math.min(value, 2000);
}

function isContentType(value: unknown): value is ContentType {
  return CONTENT_TYPES.includes(value as ContentType);
}

function toJob(row: Record<string, unknown>): CatalogueBackfillJob {
  const kind = row.kind;
  if (!isContentType(kind)) throw new Error(`Invalid backfill job kind "${String(kind)}"`);
  return {
    id: String(row.id),
    kind,
    source: row.source === 'tmdb_changes' ? 'tmdb_changes' : 'tmdb_export',
    snapshot_date: String(row.snapshot_date),
    status:
      row.status === 'pending' ||
      row.status === 'running' ||
      row.status === 'paused' ||
      row.status === 'completed' ||
      row.status === 'failed'
        ? row.status
        : 'failed',
    regions: Array.isArray(row.regions) ? row.regions.map(String) : [],
    language: String(row.language ?? DEFAULT_LANGUAGE),
    include_adult: row.include_adult !== false,
    include_unreleased: row.include_unreleased !== false,
    batch_size:
      typeof row.batch_size === 'number' && Number.isFinite(row.batch_size)
        ? row.batch_size
        : DEFAULT_BATCH_SIZE,
    total_candidates:
      typeof row.total_candidates === 'number' && Number.isFinite(row.total_candidates)
        ? row.total_candidates
        : 0,
    processed_count:
      typeof row.processed_count === 'number' && Number.isFinite(row.processed_count)
        ? row.processed_count
        : 0,
    title_count:
      typeof row.title_count === 'number' && Number.isFinite(row.title_count) ? row.title_count : 0,
    video_count:
      typeof row.video_count === 'number' && Number.isFinite(row.video_count) ? row.video_count : 0,
    availability_count:
      typeof row.availability_count === 'number' && Number.isFinite(row.availability_count)
        ? row.availability_count
        : 0,
    error_count:
      typeof row.error_count === 'number' && Number.isFinite(row.error_count) ? row.error_count : 0,
    skipped_count:
      typeof row.skipped_count === 'number' && Number.isFinite(row.skipped_count)
        ? row.skipped_count
        : 0,
    last_error: typeof row.last_error === 'string' ? row.last_error : null,
  };
}

function toCursor(row: Record<string, unknown>): CatalogueBackfillCursor {
  return {
    job_id: String(row.job_id),
    next_offset:
      typeof row.next_offset === 'number' && Number.isFinite(row.next_offset) ? row.next_offset : 0,
    batch_size:
      typeof row.batch_size === 'number' && Number.isFinite(row.batch_size)
        ? row.batch_size
        : DEFAULT_BATCH_SIZE,
    last_processed_tmdb_id:
      typeof row.last_processed_tmdb_id === 'number' ? row.last_processed_tmdb_id : null,
    consecutive_failures:
      typeof row.consecutive_failures === 'number' && Number.isFinite(row.consecutive_failures)
        ? row.consecutive_failures
        : 0,
  };
}

async function loadJobById(supabase: SupabaseClient, jobId: string): Promise<CatalogueBackfillJob> {
  const { data, error } = await supabase
    .from('catalogue_backfill_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (error) throw new Error(`Backfill job load failed: ${error.message}`);
  return toJob(data as Record<string, unknown>);
}

async function findActiveJob(
  supabase: SupabaseClient,
  kind: ContentType,
): Promise<CatalogueBackfillJob | null> {
  const { data, error } = await supabase
    .from('catalogue_backfill_jobs')
    .select('*')
    .eq('kind', kind)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Backfill job lookup failed: ${error.message}`);
  return data ? toJob(data as Record<string, unknown>) : null;
}

async function loadCursor(
  supabase: SupabaseClient,
  jobId: string,
): Promise<CatalogueBackfillCursor> {
  const { data, error } = await supabase
    .from('catalogue_backfill_cursors')
    .select('*')
    .eq('job_id', jobId)
    .single();
  if (error) throw new Error(`Backfill cursor load failed: ${error.message}`);
  return toCursor(data as Record<string, unknown>);
}

async function createBatch(input: {
  supabase: SupabaseClient;
  job: CatalogueBackfillJob;
  cursor: CatalogueBackfillCursor;
  candidateIds: number[];
}): Promise<string> {
  const batchNumber = Math.floor(input.cursor.next_offset / input.cursor.batch_size) + 1;
  const { data, error } = await input.supabase
    .from('catalogue_backfill_batches')
    .insert({
      job_id: input.job.id,
      batch_number: batchNumber,
      offset_start: input.cursor.next_offset,
      offset_end: input.cursor.next_offset + input.candidateIds.length,
      candidate_ids: input.candidateIds,
      status: 'running',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Backfill batch insert failed: ${error.message}`);
  const id = (data as BatchRow | null)?.id;
  if (!id) throw new Error('Backfill batch insert did not return an id');
  return id;
}

async function persistCandidates(input: {
  supabase: SupabaseClient;
  jobId: string;
  candidates: Array<{ tmdbId: number; popularity?: number; adult?: boolean }>;
}): Promise<void> {
  for (let index = 0; index < input.candidates.length; index += CANDIDATE_CHUNK_SIZE) {
    const chunk = input.candidates.slice(index, index + CANDIDATE_CHUNK_SIZE);
    const rows = chunk.map((candidate, chunkIndex) => ({
      job_id: input.jobId,
      offset_index: index + chunkIndex,
      tmdb_id: candidate.tmdbId,
      popularity: candidate.popularity ?? 0,
      adult: candidate.adult === true,
    }));
    const { error } = await input.supabase
      .from('catalogue_backfill_candidates')
      .upsert(rows, { onConflict: 'job_id,offset_index' });
    if (error) throw new Error(`Backfill candidate snapshot write failed: ${error.message}`);
  }
}

async function loadCandidateBatch(input: {
  supabase: SupabaseClient;
  job: CatalogueBackfillJob;
  offsetStart: number;
  batchSize: number;
}): Promise<Array<{ kind: ContentType; tmdbId: number; popularity: number; adult: boolean }>> {
  const { data, error } = await input.supabase
    .from('catalogue_backfill_candidates')
    .select('tmdb_id,popularity,adult')
    .eq('job_id', input.job.id)
    .gte('offset_index', input.offsetStart)
    .lt('offset_index', input.offsetStart + input.batchSize)
    .order('offset_index', { ascending: true });
  if (error) throw new Error(`Backfill candidate batch load failed: ${error.message}`);
  return ((data ?? []) as CandidateRow[]).map((row) => ({
    kind: input.job.kind,
    tmdbId: row.tmdb_id,
    popularity:
      typeof row.popularity === 'string'
        ? Number.parseFloat(row.popularity)
        : (row.popularity ?? 0),
    adult: row.adult === true,
  }));
}

export async function startCatalogueBackfillJob(
  options: StartCatalogueBackfillJobOptions,
): Promise<CatalogueBackfillJob> {
  const regions = normalizeRegions(options.regions);
  const batchSize = normalizeBatchSize(options.batchSize);
  const { snapshotDate, candidates } = await options.tmdb.getExportCandidates({
    kind: options.kind,
    snapshotDate: options.snapshotDate,
    maxCandidates: options.maxCandidates,
    includeAdult: options.includeAdult ?? true,
  });

  const { data, error } = await options.supabase
    .from('catalogue_backfill_jobs')
    .insert({
      kind: options.kind,
      source: 'tmdb_export',
      snapshot_date: snapshotDate,
      status: 'pending',
      regions,
      language: options.language ?? DEFAULT_LANGUAGE,
      include_adult: options.includeAdult ?? true,
      include_unreleased: options.includeUnreleased ?? true,
      batch_size: batchSize,
      total_candidates: candidates.length,
    })
    .select('*')
    .single();
  if (error) throw new Error(`Backfill job insert failed: ${error.message}`);
  const job = toJob(data as Record<string, unknown>);

  const { error: cursorError } = await options.supabase.from('catalogue_backfill_cursors').insert({
    job_id: job.id,
    next_offset: 0,
    batch_size: batchSize,
  });
  if (cursorError) throw new Error(`Backfill cursor insert failed: ${cursorError.message}`);
  await persistCandidates({
    supabase: options.supabase,
    jobId: job.id,
    candidates,
  });
  return job;
}

async function resolveJob(
  options: ProcessCatalogueBackfillStepOptions,
): Promise<CatalogueBackfillJob> {
  if (options.jobId) return await loadJobById(options.supabase, options.jobId);
  if (!options.kind) throw new Error('Backfill step requires jobId or kind');
  const existing = await findActiveJob(options.supabase, options.kind);
  if (existing) return existing;
  if (options.autoStart === false) throw new Error(`No active ${options.kind} backfill job found`);
  return await startCatalogueBackfillJob({
    supabase: options.supabase,
    tmdb: options.tmdb,
    kind: options.kind,
    regions: options.regions,
    language: options.language,
    snapshotDate: options.snapshotDate,
    batchSize: options.batchSize,
    includeAdult: options.includeAdult,
    includeUnreleased: options.includeUnreleased,
    maxCandidates: options.maxCandidates,
  });
}

export async function processCatalogueBackfillStep(
  options: ProcessCatalogueBackfillStepOptions,
): Promise<CatalogueBackfillStepResult> {
  const startedAt = Date.now();
  const maxMs = (options.maxSeconds ?? DEFAULT_MAX_SECONDS) * 1000;
  const job = await resolveJob(options);
  const cursor = await loadCursor(options.supabase, job.id);
  const batchSize = normalizeBatchSize(options.batchSize ?? cursor.batch_size ?? job.batch_size);

  if (job.status === 'completed') {
    return {
      jobId: job.id,
      kind: job.kind,
      dryRun: options.dryRun === true,
      status: 'completed',
      offsetStart: cursor.next_offset,
      offsetEnd: cursor.next_offset,
      totalCandidates: job.total_candidates,
      processedCount: job.processed_count,
      succeededIds: [],
      failedIds: [],
      titleCount: 0,
      videoCount: 0,
      availabilityCount: 0,
      nextOffset: cursor.next_offset,
      completed: true,
    };
  }

  await options.supabase
    .from('catalogue_backfill_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id)
    .in('status', ['pending', 'running']);

  const totalCandidates = job.total_candidates;
  const batch = await loadCandidateBatch({
    supabase: options.supabase,
    job,
    offsetStart: cursor.next_offset,
    batchSize,
  });

  if (batch.length === 0) {
    await options.supabase
      .from('catalogue_backfill_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_candidates: totalCandidates,
      })
      .eq('id', job.id);
    return {
      jobId: job.id,
      kind: job.kind,
      dryRun: options.dryRun === true,
      status: 'completed',
      offsetStart: cursor.next_offset,
      offsetEnd: cursor.next_offset,
      totalCandidates,
      processedCount: job.processed_count,
      succeededIds: [],
      failedIds: [],
      titleCount: 0,
      videoCount: 0,
      availabilityCount: 0,
      nextOffset: cursor.next_offset,
      completed: true,
    };
  }

  const candidateIds = batch.map((candidate) => candidate.tmdbId);
  const batchId = await createBatch({ supabase: options.supabase, job, cursor, candidateIds });
  const succeededIds: number[] = [];
  const failedIds: number[] = [];
  let titleCount = 0;
  let videoCount = 0;
  let availabilityCount = 0;
  let lastError: string | null = null;

  for (const candidate of batch) {
    if (Date.now() - startedAt > maxMs) break;
    try {
      const summary = await runCatalogueIngestion({
        supabase: options.supabase,
        tmdb: options.tmdb,
        regions: job.regions,
        kinds: [job.kind],
        language: job.language,
        explicitTitles: [{ kind: candidate.kind, tmdbId: candidate.tmdbId }],
        dryRun: options.dryRun === true,
        useCache: options.useCache ?? true,
        batchId,
        ingestionSource: 'backfill',
      });
      succeededIds.push(candidate.tmdbId);
      titleCount += summary.titleCount;
      videoCount += summary.videoCount;
      availabilityCount += summary.availabilityCount;
    } catch (error) {
      failedIds.push(candidate.tmdbId);
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const processedThisStep = succeededIds.length + failedIds.length;
  const nextOffset = cursor.next_offset + processedThisStep;
  const completed = nextOffset >= totalCandidates;
  const status = failedIds.length > 0 ? 'failed' : 'completed';

  await options.supabase
    .from('catalogue_backfill_batches')
    .update({
      status,
      succeeded_ids: succeededIds,
      failed_ids: failedIds,
      duration_ms: Date.now() - startedAt,
      api_calls: processedThisStep,
      error: lastError,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  await options.supabase
    .from('catalogue_backfill_cursors')
    .update({
      next_offset: nextOffset,
      last_processed_tmdb_id: candidateIds[processedThisStep - 1] ?? null,
      last_step_at: new Date().toISOString(),
      consecutive_failures: failedIds.length > 0 ? cursor.consecutive_failures + 1 : 0,
    })
    .eq('job_id', job.id);

  await options.supabase
    .from('catalogue_backfill_jobs')
    .update({
      status: completed ? 'completed' : 'running',
      total_candidates: totalCandidates,
      processed_count: job.processed_count + processedThisStep,
      title_count: job.title_count + titleCount,
      video_count: job.video_count + videoCount,
      availability_count: job.availability_count + availabilityCount,
      error_count: job.error_count + failedIds.length,
      last_error: lastError,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', job.id);

  return {
    jobId: job.id,
    kind: job.kind,
    dryRun: options.dryRun === true,
    status: completed ? 'completed' : 'running',
    offsetStart: cursor.next_offset,
    offsetEnd: nextOffset,
    totalCandidates,
    processedCount: job.processed_count + processedThisStep,
    succeededIds,
    failedIds,
    titleCount,
    videoCount,
    availabilityCount,
    nextOffset,
    completed,
  };
}
