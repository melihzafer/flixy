// Supabase Edge Function: catalogue-ingest
// Invoked on a cron by pg_cron + pg_net. Authenticates with a shared
// CRON_SECRET bearer token, then runs a TMDB ingestion pass and writes a
// summary row to public.catalogue_ingest_runs.
//
// PASS 1 (this file): scaffolding only — auth, env, body parsing, run-row
// logging, and the request/response shape. The actual TMDB ingest is a
// stub that records a 'dry_run' row and returns the planned scope, so we
// can verify the cron → function pipe end-to-end.
//
// PASS 2 (next): port @flixy/catalogue-ingest mapper/writer into this
// function and replace the stub.

import { createClient } from 'npm:@supabase/supabase-js@2';

type IngestMode = 'trending' | 'full';
type ContentKind = 'movie' | 'tv';

type RequestBody = {
  mode?: IngestMode;
  regions?: string[];
  kinds?: ContentKind[];
  limit?: number;
  dryRun?: boolean;
};

type ResponseBody = {
  ok: boolean;
  runId?: string;
  mode: IngestMode;
  regions: string[];
  kinds: ContentKind[];
  limit: number;
  dryRun: boolean;
  message: string;
};

const DEFAULT_REGIONS = ['US', 'TR', 'BG', 'ES', 'DE', 'FR', 'BR'];
const DEFAULT_KINDS: ContentKind[] = ['movie', 'tv'];
const DEFAULT_LIMIT_TRENDING = 20;
const DEFAULT_LIMIT_FULL = 40;

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

function isValidKind(value: unknown): value is ContentKind {
  return value === 'movie' || value === 'tv';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  // Auth: shared bearer secret. The platform's anon/service JWT is *not*
  // accepted here — pg_cron callers must use CRON_SECRET so a leaked
  // anon key cannot trigger ingestion runs.
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

  const mode: IngestMode = body.mode === 'full' ? 'full' : 'trending';
  const regions =
    Array.isArray(body.regions) && body.regions.length > 0
      ? body.regions.map((r) => String(r).toUpperCase()).filter((r) => /^[A-Z]{2}$/.test(r))
      : DEFAULT_REGIONS;
  const kinds =
    Array.isArray(body.kinds) && body.kinds.length > 0
      ? body.kinds.filter(isValidKind)
      : DEFAULT_KINDS;
  const limit =
    typeof body.limit === 'number' && body.limit > 0
      ? Math.min(Math.floor(body.limit), 100)
      : mode === 'trending'
        ? DEFAULT_LIMIT_TRENDING
        : DEFAULT_LIMIT_FULL;
  const dryRun = body.dryRun !== false;

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = requireEnv('SUPABASE_URL');
    serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // PASS 1 stub: record a run row so we can verify cron → function → DB.
  const { data, error } = await supabase
    .from('catalogue_ingest_runs')
    .insert({
      mode: dryRun ? 'dry_run' : 'write',
      regions,
      content_types: kinds,
      requested_limit: limit,
      candidate_count: 0,
      title_count: 0,
      video_count: 0,
      availability_count: 0,
      error_message: 'pass-1 stub: ingestion logic not yet ported to edge function',
    })
    .select('id')
    .single();

  if (error) {
    return jsonResponse(500, {
      ok: false,
      error: `run_log_insert_failed: ${error.message}`,
    });
  }

  const responseBody: ResponseBody = {
    ok: true,
    runId: data?.id,
    mode,
    regions,
    kinds,
    limit,
    dryRun,
    message: 'pass-1 stub: scope acknowledged, ingest logic to follow',
  };
  return jsonResponse(200, responseBody);
});
