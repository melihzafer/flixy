import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ContentType,
  IngestPlan,
  IngestWriteSummary,
  PlannedAvailabilityRow,
  PlannedVideoRow,
} from './types.ts';

type TitleIdentity = { id: string; tmdb_id: number; content_type: ContentType };
type TitleRowWithProvenance = IngestPlan['titleRows'][number] & {
  last_backfill_batch_id?: string;
  last_ingested_at?: string;
  ingestion_source?: 'backfill' | 'changes' | 'trending';
};

const TITLE_CHUNK_SIZE = 100;
const CHILD_ROW_CHUNK_SIZE = 500;

function titleKey(input: { tmdb_id: number; content_type: ContentType }): string {
  return `${input.content_type}:${input.tmdb_id}`;
}

function withTitleId<T extends PlannedVideoRow | PlannedAvailabilityRow>(
  row: T,
  ids: Map<string, string>,
): Omit<T, 'tmdb_id' | 'content_type'> & { title_id: string } {
  const id = ids.get(titleKey(row));
  if (!id) throw new Error(`Missing title UUID for ${titleKey(row)}`);
  const { tmdb_id: _tmdbId, content_type: _contentType, ...rest } = row;
  return { ...rest, title_id: id };
}

async function resolveTitleIds(
  supabase: SupabaseClient,
  plan: IngestPlan,
): Promise<Map<string, string>> {
  const tmdbIds = Array.from(new Set(plan.titleRows.map((row) => row.tmdb_id)));
  if (tmdbIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('titles')
    .select('id,tmdb_id,content_type')
    .in('tmdb_id', tmdbIds);
  if (error) throw new Error(`Resolving title UUIDs failed: ${error.message}`);

  const ids = new Map<string, string>();
  for (const row of (data ?? []) as TitleIdentity[]) {
    ids.set(titleKey(row), row.id);
  }

  const missing = plan.titleRows.map(titleKey).filter((key) => !ids.has(key));
  if (missing.length > 0) {
    throw new Error(`Title UUID resolution missed ${missing.join(', ')}`);
  }
  return ids;
}

export function dryRunSummary(plan: IngestPlan, candidateCount: number): IngestWriteSummary {
  return {
    dryRun: true,
    candidateCount,
    titleCount: plan.titleRows.length,
    videoCount: plan.videoRows.length,
    availabilityCount: plan.availabilityRows.length,
    availabilityRefreshCount: plan.availabilityRefreshes.length,
    titleIds: {},
  };
}

function chunks<T>(rows: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    output.push(rows.slice(index, index + size));
  }
  return output;
}

function withProvenance(input: {
  plan: IngestPlan;
  batchId?: string;
  ingestionSource?: 'backfill' | 'changes' | 'trending';
}): TitleRowWithProvenance[] {
  if (!input.batchId && !input.ingestionSource) return input.plan.titleRows;
  const now = new Date().toISOString();
  return input.plan.titleRows.map((row) => ({
    ...row,
    ...(input.batchId ? { last_backfill_batch_id: input.batchId } : {}),
    ...(input.ingestionSource
      ? { ingestion_source: input.ingestionSource, last_ingested_at: now }
      : {}),
  }));
}

export async function upsertIngestPlan(input: {
  supabase: SupabaseClient;
  plan: IngestPlan;
  candidateCount: number;
  dryRun?: boolean;
  batchId?: string;
  ingestionSource?: 'backfill' | 'changes' | 'trending';
}): Promise<IngestWriteSummary> {
  if (input.dryRun) return dryRunSummary(input.plan, input.candidateCount);

  const titleRows = withProvenance({
    plan: input.plan,
    batchId: input.batchId,
    ingestionSource: input.ingestionSource,
  });
  for (const rows of chunks(titleRows, TITLE_CHUNK_SIZE)) {
    const { error } = await input.supabase
      .from('titles')
      .upsert(rows, { onConflict: 'tmdb_id,content_type' });
    if (error) throw new Error(`Title upsert failed: ${error.message}`);
  }

  const ids = await resolveTitleIds(input.supabase, input.plan);

  for (const chunk of chunks(input.plan.videoRows, CHILD_ROW_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;
    const rows = chunk.map((row) => withTitleId(row, ids));
    const { error } = await input.supabase
      .from('title_videos')
      .upsert(rows, { onConflict: 'title_id,provider,video_key' });
    if (error) throw new Error(`Title video upsert failed: ${error.message}`);
  }

  for (const refresh of input.plan.availabilityRefreshes) {
    const titleId = ids.get(titleKey(refresh));
    if (!titleId) throw new Error(`Missing title UUID for availability ${titleKey(refresh)}`);
    const { error } = await input.supabase
      .from('title_availability')
      .delete()
      .eq('title_id', titleId)
      .eq('region', refresh.region);
    if (error) throw new Error(`Availability refresh failed: ${error.message}`);
  }

  for (const chunk of chunks(input.plan.availabilityRows, CHILD_ROW_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;
    const rows = chunk.map((row) => withTitleId(row, ids));
    const { error } = await input.supabase.from('title_availability').insert(rows);
    if (error) throw new Error(`Availability insert failed: ${error.message}`);
  }

  return {
    dryRun: false,
    candidateCount: input.candidateCount,
    titleCount: input.plan.titleRows.length,
    videoCount: input.plan.videoRows.length,
    availabilityCount: input.plan.availabilityRows.length,
    availabilityRefreshCount: input.plan.availabilityRefreshes.length,
    titleIds: Object.fromEntries(ids),
  };
}
