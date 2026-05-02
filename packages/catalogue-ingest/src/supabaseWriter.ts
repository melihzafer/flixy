import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ContentType,
  IngestPlan,
  IngestWriteSummary,
  PlannedAvailabilityRow,
  PlannedVideoRow,
} from './types';

type TitleIdentity = { id: string; tmdb_id: number; content_type: ContentType };

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

export async function upsertIngestPlan(input: {
  supabase: SupabaseClient;
  plan: IngestPlan;
  candidateCount: number;
  dryRun?: boolean;
}): Promise<IngestWriteSummary> {
  if (input.dryRun) return dryRunSummary(input.plan, input.candidateCount);

  if (input.plan.titleRows.length > 0) {
    const { error } = await input.supabase
      .from('titles')
      .upsert(input.plan.titleRows, { onConflict: 'tmdb_id,content_type' });
    if (error) throw new Error(`Title upsert failed: ${error.message}`);
  }

  const ids = await resolveTitleIds(input.supabase, input.plan);

  if (input.plan.videoRows.length > 0) {
    const rows = input.plan.videoRows.map((row) => withTitleId(row, ids));
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

  if (input.plan.availabilityRows.length > 0) {
    const rows = input.plan.availabilityRows.map((row) => withTitleId(row, ids));
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
