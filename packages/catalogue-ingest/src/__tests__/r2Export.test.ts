import { buildR2TitleDocument } from '../r2Export';

describe('R2 catalogue export', () => {
  it('builds title documents with embedded availability and videos', () => {
    const document = buildR2TitleDocument({
      title: {
        id: 'title-id',
        tmdb_id: 155,
        content_type: 'movie',
        title: 'The Dark Knight',
        original_title: 'The Dark Knight',
        synopsis: 'Batman faces the Joker.',
        poster_url: 'https://image.example/poster.jpg',
        backdrop_url: null,
        trailer_key: 'abc123',
        release_year: 2008,
        runtime_minutes: 152,
        content_rating: 'PG-13',
        imdb_rating: 9,
        imdb_votes: 1000,
        critic_score: 94,
        popularity: 980,
        genres: ['action', 'crime'],
        language: 'en',
        is_adult: false,
        tagline: null,
        directors: ['Christopher Nolan'],
        creators: [],
        cast: ['Christian Bale'],
        external_ids: { imdb_id: 'tt0468569' },
        tmdb_vote_average: 8.5,
        awards: null,
        metadata_source: 'tmdb',
        updated_at: '2026-05-09T00:00:00.000Z',
        ingested_at: '2026-05-09T00:00:00.000Z',
        last_ingested_at: null,
      },
      availability: [
        {
          title_id: 'title-id',
          service_id: 'netflix',
          region: 'US',
          offer_type: 'subscription',
          deep_link: null,
          observed_at: '2026-05-09T00:00:00.000Z',
        },
      ],
      videos: [
        {
          title_id: 'title-id',
          provider: 'youtube',
          video_key: 'abc123',
          video_type: 'Trailer',
          site: 'YouTube',
          official: true,
          language: 'en',
          region: 'US',
          published_at: null,
          observed_at: '2026-05-09T00:00:00.000Z',
        },
      ],
    });

    expect(document).toMatchObject({
      id: 'title-id',
      tmdb_id: 155,
      availability: [{ service_id: 'netflix' }],
      videos: [{ video_key: 'abc123' }],
    });
  });
});
