// Supabase Edge Function: embed-titles
// Backfills title plot embeddings for the content-based recommender
// (migrations 0018/0021) using Supabase's built-in gte-small model
// (384-dim) — runs in-process, so it is zero-cost and needs no external API
// key. Cron-driven in small batches; idempotent (already-embedded titles are
// skipped by get_titles_needing_embeddings).

import { createClient } from 'npm:@supabase/supabase-js@2';

import { backfillEmbeddings } from '../_shared/catalogue/embeddings.ts';

// Minimal declaration for the edge-runtime built-in inference API.
declare const Supabase: {
  ai: {
    Session: new (
      model: string,
    ) => {
      run(input: string, opts?: { mean_pool?: boolean; normalize?: boolean }): Promise<number[]>;
    };
  };
};

type RequestBody = {
  batchSize?: number;
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

  // Built-in gte-small model — no external API, no key, no cost.
  const session = new Supabase.ai.Session('gte-small');
  const embed = (text: string) => session.run(text, { mean_pool: true, normalize: true });

  try {
    const summary = await backfillEmbeddings({
      supabase,
      embed,
      batchSize: body.batchSize,
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
