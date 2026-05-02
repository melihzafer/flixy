// Supabase Edge Function: omdb-enrich
// Runs OMDb enrichment for titles whose external_ids include an imdb_id and
// whose omdb_enriched_at is stale (or null). Free tier: 1000 OMDb req/day,
// so we cap batch size and cache hits in tmdb_ingest_cache.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { OmdbClient } from '../_shared/catalogue/omdbClient.ts';
import { enrichWithOmdb } from '../_shared/catalogue/omdbEnrich.ts';

type RequestBody = {
  batchSize?: number;
  reenrichAfterDays?: number;
  dryRun?: boolean;
};

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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return jsonResponse(500, { ok: false, error: 'cron_secret_unset' });
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${expected}`) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' });
  }

  let body: RequestBody = {};
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as RequestBody) : {};
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let omdbApiKey: string;
  try {
    supabaseUrl = requireEnv('SUPABASE_URL');
    serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    omdbApiKey = requireEnv('OMDB_API_KEY');
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const omdb = new OmdbClient({ apiKey: omdbApiKey });

  try {
    const summary = await enrichWithOmdb({
      supabase,
      omdb,
      batchSize: body.batchSize,
      reenrichAfterDays: body.reenrichAfterDays,
      dryRun: body.dryRun ?? false,
    });
    return jsonResponse(200, { ok: true, ...summary });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
