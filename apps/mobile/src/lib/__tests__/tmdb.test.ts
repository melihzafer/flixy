jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      tmdbApiKey: 'test-key',
    },
  },
}));

import { fetchTmdbTitle, mapTmdbToTitle } from '../tmdb';

describe('TMDB request reliability', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('attaches an abort signal to external requests', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 123,
        title: 'Test title',
        genres: [],
      }),
    } as Response);

    await fetchTmdbTitle(123, 'movie');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses a YouTube teaser when a title has no official trailer', () => {
    const title = mapTmdbToTitle(
      {
        id: 456,
        title: 'Teaser title',
        genres: [],
        videos: {
          results: [{ type: 'Teaser', site: 'YouTube', key: 'teaser-key' }],
        },
      },
      'movie',
    );

    expect(title.trailerKey).toBe('teaser-key');
  });
});
