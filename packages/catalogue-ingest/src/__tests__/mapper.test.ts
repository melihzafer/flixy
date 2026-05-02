import {
  type TmdbMovieDetail,
  type TmdbTvDetail,
  mapTmdbTitleDetail,
  mergeIngestPlans,
} from '../mapper';
import { dryRunSummary } from '../supabaseWriter';

const observedAt = '2026-05-02T00:00:00.000Z';

describe('TMDB ingestion mapping', () => {
  it('maps movie details without cross-contaminating TMDB votes into IMDb ratings', () => {
    const movie: TmdbMovieDetail = {
      id: 155,
      title: 'The Dark Knight',
      original_title: 'The Dark Knight',
      overview: 'Batman faces the Joker.',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      release_date: '2008-07-18',
      runtime: 152,
      vote_average: 8.5,
      popularity: 1000,
      genres: [{ id: 28 }, { id: 80 }, { id: 53 }],
      adult: false,
      original_language: 'en',
      tagline: 'Why So Serious?',
      credits: {
        cast: [
          { name: 'Christian Bale', order: 0 },
          { name: 'Heath Ledger', order: 1 },
        ],
        crew: [{ name: 'Christopher Nolan', job: 'Director' }],
      },
      videos: {
        results: [
          {
            key: 'teaser',
            site: 'YouTube',
            type: 'Teaser',
            official: true,
            iso_639_1: 'en',
            iso_3166_1: 'US',
          },
          {
            key: 'trailer',
            site: 'YouTube',
            type: 'Trailer',
            official: true,
            iso_639_1: 'en',
            iso_3166_1: 'US',
          },
        ],
      },
      release_dates: {
        results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG-13' }] }],
      },
      'watch/providers': {
        results: {
          US: {
            link: 'https://tmdb.example/dark-knight',
            flatrate: [{ provider_id: 384, provider_name: 'HBO Max' }],
            rent: [{ provider_id: 9, provider_name: 'Amazon Prime Video' }],
          },
        },
      },
      external_ids: { imdb_id: 'tt0468569' },
    };

    const plan = mapTmdbTitleDetail({
      item: { kind: 'movie', detail: movie },
      regions: ['US'],
      observedAt,
    });

    expect(plan.titleRows[0]).toMatchObject({
      tmdb_id: 155,
      content_type: 'movie',
      title: 'The Dark Knight',
      release_year: 2008,
      runtime_minutes: 152,
      content_rating: 'PG-13',
      imdb_rating: null,
      tmdb_vote_average: 8.5,
      metadata_source: 'tmdb',
      directors: ['Christopher Nolan'],
      cast: ['Christian Bale', 'Heath Ledger'],
      external_ids: { imdb_id: 'tt0468569' },
    });
    expect(plan.titleRows[0]).not.toHaveProperty('id');
    expect(plan.videoRows[0]?.video_key).toBe('trailer');
    expect(plan.availabilityRows).toEqual([
      expect.objectContaining({ service_id: 'hbo_max', offer_type: 'subscription', region: 'US' }),
      expect.objectContaining({ service_id: 'prime_video', offer_type: 'rent', region: 'US' }),
    ]);
  });

  it('maps TV details with creator separation and per-region availability refreshes', () => {
    const tv: TmdbTvDetail = {
      id: 1100,
      name: 'How I Met Your Mother',
      original_name: 'How I Met Your Mother',
      overview: 'Ted tells a long story.',
      first_air_date: '2005-09-19',
      episode_run_time: [22],
      vote_average: 8.2,
      popularity: 765,
      genres: [{ id: 35 }, { id: 10749 }],
      original_language: 'en',
      created_by: [{ name: 'Carter Bays' }, { name: 'Craig Thomas' }],
      aggregate_credits: {
        cast: [
          { name: 'Josh Radnor', order: 0 },
          { name: 'Cobie Smulders', order: 2 },
        ],
      },
      content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-14' }] },
      videos: {
        results: [
          {
            key: 'himym-trailer',
            site: 'YouTube',
            type: 'Trailer',
            official: false,
            iso_639_1: 'en',
          },
        ],
      },
      'watch/providers': {
        results: {
          US: { flatrate: [{ provider_id: 15, provider_name: 'Hulu' }] },
          TR: { rent: [{ provider_name: 'Amazon Prime Video' }] },
        },
      },
    };

    const plan = mapTmdbTitleDetail({
      item: { kind: 'tv', detail: tv },
      regions: ['US', 'TR'],
      observedAt,
    });

    expect(plan.titleRows[0]).toMatchObject({
      tmdb_id: 1100,
      content_type: 'tv',
      title: 'How I Met Your Mother',
      runtime_minutes: 22,
      content_rating: 'TV-14',
      directors: [],
      creators: ['Carter Bays', 'Craig Thomas'],
      cast: ['Josh Radnor', 'Cobie Smulders'],
    });
    expect(plan.availabilityRefreshes).toEqual([
      { tmdb_id: 1100, content_type: 'tv', region: 'US' },
      { tmdb_id: 1100, content_type: 'tv', region: 'TR' },
    ]);
    expect(plan.availabilityRows).toEqual([
      expect.objectContaining({ service_id: 'hulu', offer_type: 'subscription', region: 'US' }),
      expect.objectContaining({ service_id: 'prime_video', offer_type: 'rent', region: 'TR' }),
    ]);
  });

  it('deduplicates repeated title, video, and availability payloads for idempotent writes', () => {
    const tv: TmdbTvDetail = {
      id: 1100,
      name: 'How I Met Your Mother',
      popularity: 1,
      videos: { results: [{ key: 'trailer', site: 'YouTube', type: 'Trailer' }] },
      'watch/providers': {
        results: { US: { flatrate: [{ provider_id: 15, provider_name: 'Hulu' }] } },
      },
    };
    const first = mapTmdbTitleDetail({
      item: { kind: 'tv', detail: tv },
      regions: ['US'],
      observedAt,
    });
    const merged = mergeIngestPlans([first, first]);

    expect(dryRunSummary(merged, 2)).toMatchObject({
      dryRun: true,
      candidateCount: 2,
      titleCount: 1,
      videoCount: 1,
      availabilityCount: 1,
      availabilityRefreshCount: 1,
    });
  });
});
