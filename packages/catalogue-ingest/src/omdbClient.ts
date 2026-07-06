// Thin OMDb client. Used to enrich titles ingested from TMDB with IMDb
// rating + vote count + awards string. OMDb's free tier is 1000 req/day,
// so we cache aggressively in tmdb_ingest_cache (same table — namespaced
// keys) and only re-enrich after `OMDB_REENRICH_DAYS` days.

import { fetchWithTimeout } from './http';

export type OmdbDetail = {
  imdbRating: string | null;
  imdbVotes: string | null;
  awards: string | null;
};

export type OmdbClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type OmdbRawResponse = {
  Response?: 'True' | 'False';
  Error?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Awards?: string;
};

export class OmdbClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OmdbClientOptions) {
    if (!options.apiKey) throw new Error('OMDb auth requires OMDB_API_KEY');
    this.baseUrl = options.baseUrl ?? 'https://www.omdbapi.com/';
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getByImdbId(imdbId: string): Promise<OmdbDetail | null> {
    if (!/^tt\d{6,}$/.test(imdbId)) return null;
    const url = new URL(this.baseUrl);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('i', imdbId);
    url.searchParams.set('tomatoes', 'false');
    url.searchParams.set('plot', 'short');

    const response = await fetchWithTimeout(this.fetchImpl, url.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`OMDb request failed (${response.status} ${response.statusText})`);
    }
    const body = (await response.json()) as OmdbRawResponse;
    if (body.Response === 'False') {
      // Common case: "Movie not found!" — treat as a clean miss, not an error.
      return null;
    }
    return {
      imdbRating: clean(body.imdbRating),
      imdbVotes: clean(body.imdbVotes),
      awards: clean(body.Awards),
    };
  }
}

function clean(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'N/A') return null;
  return trimmed;
}
