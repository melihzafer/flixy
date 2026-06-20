import { gzipSync } from 'node:zlib';

import { TmdbClient, defaultTmdbExportSnapshotDate } from '../tmdbClient';

function gzippedResponse(lines: string): Response {
  return new Response(gzipSync(Buffer.from(lines, 'utf8')), { status: 200, statusText: 'OK' });
}

describe('TmdbClient export discovery', () => {
  it('reads TMDB daily exports, filters adult rows when requested, and sorts by popularity', async () => {
    const seenUrls: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      seenUrls.push(String(url));
      return gzippedResponse(
        [
          JSON.stringify({ id: 10, popularity: 4, adult: false }),
          JSON.stringify({ id: 11, popularity: 99, adult: true }),
          JSON.stringify({ id: 12, popularity: 20, adult: false }),
          JSON.stringify({ id: null, popularity: 100 }),
        ].join('\n'),
      );
    };
    const client = new TmdbClient({
      bearerToken: 'token',
      exportBaseUrl: 'https://exports.example',
      fetchImpl,
    });

    const result = await client.getExportCandidates({
      kind: 'movie',
      snapshotDate: '2026-05-01',
      includeAdult: false,
    });

    expect(seenUrls[0]).toBe('https://exports.example/movie_ids_05_01_2026.json.gz');
    expect(result.snapshotDate).toBe('2026-05-01');
    expect(result.candidates.map((candidate) => candidate.tmdbId)).toEqual([12, 10]);
    expect(result.candidates[0]).toMatchObject({
      kind: 'movie',
      region: 'GLOBAL',
      source: 'tmdb_export',
      popularity: 20,
      adult: false,
    });
  });

  it('falls back to previous export dates when the preferred snapshot is missing', async () => {
    const seenUrls: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      seenUrls.push(String(url));
      if (seenUrls.length === 1) {
        return new Response('not found', { status: 404, statusText: 'Not Found' });
      }
      return gzippedResponse(JSON.stringify({ id: 1100, popularity: 10, adult: false }));
    };
    const client = new TmdbClient({
      bearerToken: 'token',
      exportBaseUrl: 'https://exports.example',
      fetchImpl,
    });

    const result = await client.getExportCandidates({
      kind: 'tv',
      snapshotDate: '2026-05-01',
    });

    expect(seenUrls).toEqual([
      'https://exports.example/tv_series_ids_05_01_2026.json.gz',
      'https://exports.example/tv_series_ids_04_30_2026.json.gz',
    ]);
    expect(result.snapshotDate).toBe('2026-04-30');
    expect(result.candidates[0]?.tmdbId).toBe(1100);
  });

  it('uses yesterday as the default export snapshot date', () => {
    expect(defaultTmdbExportSnapshotDate(new Date('2026-05-03T12:00:00.000Z'))).toBe('2026-05-02');
  });
});
