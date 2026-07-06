import { fetchWithTimeout } from './http.ts';
import type { CandidateRef, CandidateSource, ContentType } from './types.ts';

type TmdbListResponse = {
  results?: Array<{ id?: number }>;
  total_pages?: number;
};

type TmdbChangesResponse = {
  results?: Array<{ id?: number }>;
  total_pages?: number;
};

type TmdbExportRow = {
  id?: number;
  popularity?: number;
  adult?: boolean;
};

export type TmdbAuth =
  | { bearerToken: string; apiKey?: never }
  | { bearerToken?: never; apiKey: string };

export type TmdbClientOptions = TmdbAuth & {
  baseUrl?: string;
  exportBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

export class TmdbClient {
  private readonly baseUrl: string;
  private readonly exportBaseUrl: string;
  private readonly auth: TmdbAuth;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TmdbClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.themoviedb.org/3';
    this.exportBaseUrl = options.exportBaseUrl ?? 'https://files.tmdb.org/p/exports';
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

    const response = await fetchWithTimeout(this.fetchImpl, url.toString(), { headers });
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

  async getExportCandidates(input: {
    kind: ContentType;
    snapshotDate?: string;
    maxCandidates?: number;
    includeAdult?: boolean;
    region?: string;
  }): Promise<{ snapshotDate: string; candidates: CandidateRef[] }> {
    const { snapshotDate, text } = await this.getExportText(input.kind, input.snapshotDate);
    const includeAdult = input.includeAdult ?? true;
    const candidates: CandidateRef[] = [];

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = parseExportRow(trimmed);
      if (!parsed) continue;
      if (!includeAdult && parsed.adult === true) continue;
      candidates.push({
        kind: input.kind,
        tmdbId: parsed.id,
        region: input.region ?? 'GLOBAL',
        source: 'tmdb_export',
        popularity: parsed.popularity ?? 0,
        adult: parsed.adult === true,
      });
    }

    candidates.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.tmdbId - b.tmdbId);

    return {
      snapshotDate,
      candidates:
        input.maxCandidates && input.maxCandidates > 0
          ? candidates.slice(0, input.maxCandidates)
          : candidates,
    };
  }

  async listExportCandidates(input: {
    kind: ContentType;
    snapshotDate?: string;
    maxCandidates?: number;
    includeAdult?: boolean;
    region?: string;
  }): Promise<CandidateRef[]> {
    return (await this.getExportCandidates(input)).candidates;
  }

  async listChanges(input: {
    kind: ContentType;
    startDate: string;
    endDate: string;
    limit: number;
  }): Promise<CandidateRef[]> {
    const refs = new Map<string, CandidateRef>();
    let page = 1;
    while (refs.size < input.limit) {
      const result = await this.getJson<TmdbChangesResponse>(`/${input.kind}/changes`, {
        page,
        start_date: input.startDate,
        end_date: input.endDate,
      });
      for (const item of result.results ?? []) {
        if (typeof item.id === 'number') {
          refs.set(`${input.kind}:${item.id}`, {
            kind: input.kind,
            tmdbId: item.id,
            region: 'GLOBAL',
            source: 'tmdb_changes',
          });
        }
        if (refs.size >= input.limit) break;
      }
      const totalPages = result.total_pages ?? page;
      if (page >= totalPages || refs.size >= input.limit) break;
      page += 1;
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

  private async getExportText(
    kind: ContentType,
    preferredSnapshotDate?: string,
  ): Promise<{ snapshotDate: string; text: string }> {
    const dates = exportDateFallbacks(preferredSnapshotDate);
    let lastError: string | null = null;

    for (const snapshotDate of dates) {
      const url = `${this.exportBaseUrl}/${exportFilename(kind, snapshotDate)}`;
      const response = await fetchWithTimeout(this.fetchImpl, url, {
        headers: { accept: 'application/json' },
      });
      if (response.ok) {
        return { snapshotDate, text: await decodeExportResponse(response, url) };
      }
      const body = await response.text().catch(() => '');
      lastError = `TMDB export request failed (${response.status} ${response.statusText}): ${body.slice(
        0,
        160,
      )}`;
      if (response.status !== 404) break;
    }

    throw new Error(lastError ?? 'TMDB export request failed');
  }
}

export function defaultTmdbExportSnapshotDate(now = new Date()): string {
  const snapshot = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return snapshot.toISOString().slice(0, 10);
}

function previousDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function exportDateFallbacks(preferredSnapshotDate?: string): string[] {
  const start = preferredSnapshotDate ?? defaultTmdbExportSnapshotDate();
  return [start, previousDate(start), previousDate(previousDate(start))];
}

function exportFilename(kind: ContentType, snapshotDate: string): string {
  const match = snapshotDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid TMDB export snapshot date "${snapshotDate}"`);
  const [, year, month, day] = match;
  const prefix = kind === 'movie' ? 'movie_ids' : 'tv_series_ids';
  return `${prefix}_${month}_${day}_${year}.json.gz`;
}

function parseExportRow(
  line: string,
): (Required<Pick<TmdbExportRow, 'id'>> & TmdbExportRow) | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const row = value as TmdbExportRow;
  const id = row.id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;
  return { ...row, id };
}

async function decodeExportResponse(response: Response, url: string): Promise<string> {
  const buffer = await response.arrayBuffer();
  if (url.endsWith('.gz')) {
    if (isNodeRuntime()) {
      const [{ gunzipSync }, { Buffer }] = await Promise.all([
        import('node:zlib'),
        import('node:buffer'),
      ]);
      return gunzipSync(Buffer.from(buffer)).toString('utf8');
    }
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }
  }
  return new TextDecoder().decode(buffer);
}

function isNodeRuntime(): boolean {
  const runtime = globalThis as typeof globalThis & {
    process?: { versions?: { node?: string } };
  };
  return typeof runtime.process?.versions?.node === 'string';
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
