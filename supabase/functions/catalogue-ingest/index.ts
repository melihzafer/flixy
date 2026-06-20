// Supabase Edge Function: catalogue-ingest
// Invoked on a cron by pg_cron + pg_net. Authenticates with a shared
// CRON_SECRET bearer token, runs a TMDB ingestion pass via the shared
// mapper/writer in supabase/functions/_shared/catalogue, and records a
// summary row in public.catalogue_ingest_runs.
//
// Modes:
//   * trending — pulls TMDB trending/day per region (cheap, fresh)
//   * full     — pulls popular + now_playing/on_the_air per region
//   * backfill_step — processes one resumable TMDB export backfill step

import { createClient } from 'npm:@supabase/supabase-js@2';

import { processCatalogueBackfillStep } from '../_shared/catalogue/backfill.ts';
import { runCatalogueIngestion } from '../_shared/catalogue/ingest.ts';
import { TmdbClient } from '../_shared/catalogue/tmdbClient.ts';
import type { CandidateSource, ContentType } from '../_shared/catalogue/types.ts';

type IngestMode = 'trending' | 'full' | 'backfill_step';

type RequestBody = {
  mode?: IngestMode;
  jobId?: string;
  kind?: ContentType;
  regions?: string[];
  kinds?: ContentType[];
  limit?: number;
  dryRun?: boolean;
  language?: string;
  snapshotDate?: string;
  maxCandidates?: number;
  maxSeconds?: number;
};

const DEFAULT_REGIONS = ['US', 'TR', 'BG', 'ES', 'DE', 'FR', 'BR'];
const DEFAULT_KINDS: ContentType[] = ['movie', 'tv'];
const DEFAULT_LIMIT_TRENDING = 20;
const DEFAULT_LIMIT_FULL = 40;
const MAX_LIMIT = 100;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function isValidKind(value: unknown): value is ContentType {
  return value === 'movie' || value === 'tv';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  // Auth: shared bearer secret. The platform's anon/service JWT is *not*
  // accepted because we deploy with --no-verify-jwt; pg_cron callers
  // present CRON_SECRET so a leaked anon key cannot trigger ingestion.
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) {
    return jsonResponse(500, { ok: false, error: 'cron_secret_unset' });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${expected}`) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' });
  }

  let body: RequestBody = {};
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as RequestBody) : {};
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' });
  }

  const mode: IngestMode =
    body.mode === 'full' || body.mode === 'backfill_step' ? body.mode : 'trending';
  const regions =
    Array.isArray(body.regions) && body.regions.length > 0
      ? body.regions.map((r) => String(r).toUpperCase()).filter((r) => /^[A-Z]{2}$/.test(r))
      : DEFAULT_REGIONS;
  const kinds =
    Array.isArray(body.kinds) && body.kinds.length > 0
      ? body.kinds.filter(isValidKind)
      : DEFAULT_KINDS;
  const backfillKind = isValidKind(body.kind) ? body.kind : (kinds[0] ?? 'movie');
  const limit =
    typeof body.limit === 'number' && body.limit > 0
      ? Math.min(Math.floor(body.limit), MAX_LIMIT)
      : mode === 'trending'
        ? DEFAULT_LIMIT_TRENDING
        : DEFAULT_LIMIT_FULL;
  const dryRun = body.dryRun !== false;
  const language = body.language ?? 'en-US';

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let tmdbBearer: string;
  try {
    supabaseUrl = requireEnv('SUPABASE_URL');
    serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    tmdbBearer = requireEnv('TMDB_BEARER_TOKEN');
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const tmdb = new TmdbClient({ bearerToken: tmdbBearer });

  // trending mode: only pull TMDB trending/day. Cheaper, fresher.
  // full mode: popular + now_playing/on_the_air. Skips trending so we don't
  // double-count titles the hourly job already touched.
  const sources: CandidateSource[] =
    mode === 'trending' ? ['trending_day'] : ['popular', 'now_playing', 'on_the_air'];

  // Open run row up front so we always have a trace, even if ingestion throws.
  const { data: runRow, error: runError } = await supabase
    .from('catalogue_ingest_runs')
    .insert({
      mode: dryRun ? 'dry_run' : 'write',
      regions,
      content_types: mode === 'backfill_step' ? [backfillKind] : kinds,
      requested_limit: limit,
      candidate_count: 0,
      title_count: 0,
      video_count: 0,
      availability_count: 0,
    })
    .select('id')
    .single();

  if (runError) {
    return jsonResponse(500, {
      ok: false,
      error: `run_log_insert_failed: ${runError.message}`,
    });
  }
  if (!runRow?.id) {
    return jsonResponse(500, { ok: false, error: 'run_log_missing_id' });
  }
  const runId = runRow.id as string;

  try {
    if (mode === 'backfill_step') {
      const result = await processCatalogueBackfillStep({
        supabase,
        tmdb,
        jobId: body.jobId,
        kind: body.jobId ? undefined : backfillKind,
        regions,
        language,
        snapshotDate: body.snapshotDate,
        batchSize: limit,
        dryRun,
        includeAdult: true,
        includeUnreleased: true,
        maxCandidates: body.maxCandidates,
        maxSeconds: body.maxSeconds ?? 80,
        autoStart: true,
        useCache: true,
      });

      await supabase
        .from('catalogue_ingest_runs')
        .update({
          candidate_count: result.succeededIds.length + result.failedIds.length,
          title_count: result.titleCount,
          video_count: result.videoCount,
          availability_count: result.availabilityCount,
          error_message:
            result.failedIds.length > 0 ? `failed ids: ${result.failedIds.join(',')}` : null,
        })
        .eq('id', runId);

      return jsonResponse(200, {
        ok: true,
        runId,
        mode,
        dryRun,
        ...result,
      });
    }

    const result = await runCatalogueIngestion({
      supabase,
      tmdb,
      regions,
      kinds,
      language,
      limitPerRegionKind: limit,
      dryRun,
      sources,
      useCache: true,
      cacheTtlHours: 24,
    });

    await supabase
      .from('catalogue_ingest_runs')
      .update({
        candidate_count: result.candidateCount,
        title_count: result.titleCount,
        video_count: result.videoCount,
        availability_count: result.availabilityCount,
      })
      .eq('id', runId);

    return jsonResponse(200, {
      ok: true,
      runId,
      mode,
      dryRun,
      regions: result.regions,
      kinds: result.kinds,
      candidateCount: result.candidateCount,
      titleCount: result.titleCount,
      videoCount: result.videoCount,
      availabilityCount: result.availabilityCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from('catalogue_ingest_runs')
      .update({ error_message: message.slice(0, 500) })
      .eq('id', runId);
    return jsonResponse(500, { ok: false, runId, error: message });
  }
});
