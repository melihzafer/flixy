import type { SupabaseClient } from '@supabase/supabase-js';

// Title embedding backfill (powers the content-based recommender in
// migrations 0018/0021). Reads titles that still need an embedding via the
// get_titles_needing_embeddings RPC, embeds their text, and upserts the
// vector into title_embeddings keyed by the deterministic TMDB UUID (same id
// space the mobile client + watchlist use).
//
// The embedder is INJECTED (see embed-titles/index.ts) so this module stays
// runtime-agnostic and testable. Production uses Supabase's built-in
// gte-small model (384-dim, zero-cost, no external API key).

const EMBEDDING_DIM = 384; // must match vector(384) in title_embeddings
const DEFAULT_BATCH_SIZE = 100; // titles fetched per invocation
const UPSERT_CHUNK_SIZE = 200;

type TitleNeedingEmbedding = {
  tmdb_id: number;
  content_type: 'movie' | 'tv';
  title: string;
  synopsis: string | null;
  genres: string[] | null;
  api_uuid: string;
};

// Turns one title's text into a 384-dim vector.
export type Embedder = (text: string) => Promise<number[]>;

export type EmbedTitlesSummary = {
  dryRun: boolean;
  candidateCount: number;
  embeddedCount: number;
  skippedCount: number;
  failedCount: number;
};

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

// Combine the signal-bearing fields into the text we embed. Title + genres
// give the vector some grounding even when the synopsis is short.
function buildInput(t: TitleNeedingEmbedding): string {
  const genres = (t.genres ?? []).join(', ');
  return [t.title, genres, t.synopsis ?? ''].filter((s) => s && s.trim().length > 0).join('\n');
}

// pgvector over PostgREST expects the literal text form '[1,2,3]', not a JSON
// array — sending a number[] would not cast to vector.
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

export async function backfillEmbeddings(input: {
  supabase: SupabaseClient;
  embed: Embedder;
  batchSize?: number;
  dryRun?: boolean;
}): Promise<EmbedTitlesSummary> {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;

  const { data, error } = await input.supabase.rpc('get_titles_needing_embeddings', {
    p_limit: batchSize,
  });
  if (error) throw new Error(`get_titles_needing_embeddings failed: ${error.message}`);

  const titles = (data ?? []) as TitleNeedingEmbedding[];
  const candidates = titles.filter((t) => buildInput(t).trim().length > 0);
  const skippedCount = titles.length - candidates.length;

  if (input.dryRun) {
    return {
      dryRun: true,
      candidateCount: candidates.length,
      embeddedCount: 0,
      skippedCount,
      failedCount: 0,
    };
  }

  let failedCount = 0;
  const rows: Array<{ title_id: string; embedding: string }> = [];

  // gte-small runs in-process, so embed sequentially — no external rate limit.
  for (const t of candidates) {
    try {
      const vec = await input.embed(buildInput(t));
      if (vec.length !== EMBEDDING_DIM) {
        failedCount += 1;
        continue;
      }
      rows.push({ title_id: t.api_uuid, embedding: toVectorLiteral(vec) });
    } catch {
      failedCount += 1;
    }
  }

  let embeddedCount = 0;
  for (const rowChunk of chunks(rows, UPSERT_CHUNK_SIZE)) {
    const { error: upsertError } = await input.supabase
      .from('title_embeddings')
      .upsert(rowChunk, { onConflict: 'title_id' });
    if (upsertError) {
      failedCount += rowChunk.length;
      continue;
    }
    embeddedCount += rowChunk.length;
  }

  return {
    dryRun: false,
    candidateCount: candidates.length,
    embeddedCount,
    skippedCount,
    failedCount,
  };
}
