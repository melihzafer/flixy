import type { CandidateRef, CandidateSource, ContentType } from './types.ts';

type TmdbListResponse = {
  results?: Array<{ id?: number }>;
  total_pages?: number;
};

export type TmdbAuth =
  | { bearerToken: string; apiKey?: never }
  | { bearerToken?: never; apiKey: string };

export type TmdbClientOptions = TmdbAuth & {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class TmdbClient {
  private readonly baseUrl: string;
  private readonly auth: TmdbAuth;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TmdbClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.themoviedb.org/3';
    if ('bearerToken' in options && options.bearerToken) {
      this.auth = { bearerToken: options.bearerToken };
    } else if ('apiKey' in options && options.apiKey) {
      this.auth = { apiKey: options.apiKey };
    } else {
      throw new Error('TMDB auth requires TMDB_BEARER_TOKEN or TMDB_API_KEY');
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getJson<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if ('bearerToken' in this.auth) {
      headers.authorization = `Bearer ${this.auth.bearerToken}`;
    } else {
      url.searchParams.set('api_key', this.auth.apiKey);
    }

    const response = await this.fetchImpl(url.toString(), { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `TMDB request failed (${response.status} ${response.statusText}): ${body.slice(0, 160)}`,
      );
    }
    return (await response.json()) as T;
  }

  async listCandidates(input: {
    kind: ContentType;
    region: string;
    language?: string;
    limit: number;
    sources?: CandidateSource[];
  }): Promise<CandidateRef[]> {
    const allEndpoints = candidateEndpoints(input.kind);
    const sourceFilter = input.sources;
    const endpoints =
      sourceFilter && sourceFilter.length > 0
        ? allEndpoints.filter((endpoint) => sourceFilter.includes(endpoint.source))
        : allEndpoints;
    const refs = new Map<string, CandidateRef>();

    for (const endpoint of endpoints) {
      let page = 1;
      while (refs.size < input.limit) {
        const result = await this.getJson<TmdbListResponse>(endpoint.path, {
          page,
          region: input.region,
          language: input.language,
        });
        for (const item of result.results ?? []) {
          if (typeof item.id === 'number') {
            refs.set(`${input.kind}:${item.id}`, {
              kind: input.kind,
              tmdbId: item.id,
              region: input.region,
              source: endpoint.source,
            });
          }
          if (refs.size >= input.limit) break;
        }
        const totalPages = result.total_pages ?? page;
        if (page >= totalPages || page >= 3 || refs.size >= input.limit) break;
        page += 1;
      }
    }

    return [...refs.values()].slice(0, input.limit);
  }

  getTitleDetail(input: {
    kind: ContentType;
    tmdbId: number;
    language?: string;
  }): Promise<unknown> {
    const append =
      input.kind === 'movie'
        ? 'credits,videos,release_dates,watch/providers,external_ids'
        : 'aggregate_credits,credits,videos,content_ratings,watch/providers,external_ids';
    return this.getJson(`/${input.kind}/${input.tmdbId}`, {
      append_to_response: append,
      language: input.language,
    });
  }
}

function candidateEndpoints(kind: ContentType): Array<{ path: string; source: CandidateSource }> {
  return kind === 'movie'
    ? [
        { path: '/movie/popular', source: 'popular' },
        { path: '/trending/movie/day', source: 'trending_day' },
        { path: '/movie/now_playing', source: 'now_playing' },
      ]
    : [
        { path: '/tv/popular', source: 'popular' },
        { path: '/trending/tv/day', source: 'trending_day' },
        { path: '/tv/on_the_air', source: 'on_the_air' },
      ];
}
