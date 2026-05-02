import type { SupabaseClient } from '@supabase/supabase-js';

export async function getCachedTmdbResponse<T>(
  supabase: SupabaseClient,
  cacheKey: string,
): Promise<T | null> {
  const { data, error } = await supabase
    .from('tmdb_ingest_cache')
    .select('response,expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (error) throw new Error(`TMDB cache read failed: ${error.message}`);
  if (!data) return null;

  const expiresAt = new Date(String(data.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return data.response as T;
}

export async function setCachedTmdbResponse(input: {
  supabase: SupabaseClient;
  cacheKey: string;
  response: unknown;
  ttlHours: number;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + input.ttlHours * 60 * 60 * 1000);
  const { error } = await input.supabase.from('tmdb_ingest_cache').upsert(
    {
      cache_key: input.cacheKey,
      response: input.response,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: 'cache_key' },
  );
  if (error) throw new Error(`TMDB cache write failed: ${error.message}`);
}
