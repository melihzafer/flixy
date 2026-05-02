// Thin Trakt API client. Public endpoints (no OAuth) are sufficient for
// the trending signal we want — no user auth needed. Trakt's free tier
// is generous (no daily cap, just rate limits).
//
// What we use:
//   * /movies/trending — array of { watchers, movie: { ids: { imdb, tmdb } } }
//   * /shows/trending  — array of { watchers, show:  { ids: { imdb, tmdb } } }
// `watchers` is the count of users currently scrobbling that title — a
// strong real-time popularity signal that complements TMDB's slower
// trending/day curve.

export type TraktTrendingItem = {
  watchers: number;
  imdbId: string | null;
  tmdbId: number | null;
  contentType: 'movie' | 'tv';
};

export type TraktClientOptions = {
  clientId: string;
  baseUrl?: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
};

type TraktIds = { imdb?: string | null; tmdb?: number | null };
type TraktTrendingMovie = { watchers?: number; movie?: { ids?: TraktIds } };
type TraktTrendingShow = { watchers?: number; show?: { ids?: TraktIds } };

export class TraktClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TraktClientOptions) {
    if (!options.clientId) throw new Error('Trakt auth requires TRAKT_CLIENT_ID');
    this.baseUrl = options.baseUrl ?? 'https://api.trakt.tv';
    this.clientId = options.clientId;
    this.apiVersion = options.apiVersion ?? '2';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async getJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    const response = await this.fetchImpl(url.toString(), {
      headers: {
        'content-type': 'application/json',
        'trakt-api-version': this.apiVersion,
        'trakt-api-key': this.clientId,
      },
    });
    if (!response.ok) {
      throw new Error(`Trakt request failed (${response.status} ${response.statusText})`);
    }
    return (await response.json()) as T;
  }

  async listTrendingMovies(limit = 50): Promise<TraktTrendingItem[]> {
    const items = await this.getJson<TraktTrendingMovie[]>('/movies/trending', { limit });
    return items
      .map(
        (item): TraktTrendingItem => ({
          watchers: typeof item.watchers === 'number' ? item.watchers : 0,
          imdbId: cleanImdbId(item.movie?.ids?.imdb),
          tmdbId: typeof item.movie?.ids?.tmdb === 'number' ? item.movie.ids.tmdb : null,
          contentType: 'movie',
        }),
      )
      .filter((item) => item.tmdbId !== null || item.imdbId !== null);
  }

  async listTrendingShows(limit = 50): Promise<TraktTrendingItem[]> {
    const items = await this.getJson<TraktTrendingShow[]>('/shows/trending', { limit });
    return items
      .map(
        (item): TraktTrendingItem => ({
          watchers: typeof item.watchers === 'number' ? item.watchers : 0,
          imdbId: cleanImdbId(item.show?.ids?.imdb),
          tmdbId: typeof item.show?.ids?.tmdb === 'number' ? item.show.ids.tmdb : null,
          contentType: 'tv',
        }),
      )
      .filter((item) => item.tmdbId !== null || item.imdbId !== null);
  }
}

function cleanImdbId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^tt\d{6,}$/.test(trimmed) ? trimmed : null;
}
