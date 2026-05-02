// Supabase Edge Function: trakt-sync
// Pulls Trakt trending movies + shows, matches them against existing
// titles by tmdb_id, and updates trakt_watchers / trakt_synced_at.
// Does *not* insert new titles — Trakt is a signal source, not a catalog.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { TraktClient } from '../_shared/catalogue/traktClient.ts';
import { syncTraktTrending } from '../_shared/catalogue/traktSync.ts';

type RequestBody = {
  movieLimit?: number;
  showLimit?: number;
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
  let traktClientId: string;
  try {
    supabaseUrl = requireEnv('SUPABASE_URL');
    serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    traktClientId = requireEnv('TRAKT_CLIENT_ID');
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const trakt = new TraktClient({ clientId: traktClientId });

  try {
    const summary = await syncTraktTrending({
      supabase,
      trakt,
      movieLimit: body.movieLimit,
      showLimit: body.showLimit,
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
