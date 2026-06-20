import { OfferTypeSchema, TitleSchema } from '../title';

describe('TitleSchema', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    tmdbId: 27205,
    kind: 'movie' as const,
    title: 'Inception',
    originalTitle: 'Inception',
    overview: 'A thief who steals corporate secrets.',
    posterUrl: 'https://image.tmdb.org/t/p/w780/poster.jpg',
    backdropUrl: null,
    trailerKey: null,
    releaseYear: 2010,
    runtimeMinutes: 148,
    imdbRating: 8.8,
    popularity: 950,
    genres: ['action', 'sci_fi'],
    language: 'en',
  };

  it('accepts a valid title and defaults availability to []', () => {
    const parsed = TitleSchema.parse(base);
    expect(parsed.availability).toEqual([]);
    expect(parsed.kind).toBe('movie');
  });

  it('accepts optional authoritative metadata without requiring fabricated fields', () => {
    const parsed = TitleSchema.parse({
      ...base,
      kind: 'tv',
      contentRating: 'TV-MA',
      criticScore: 94,
      tagline: 'Winter is coming.',
      directors: [],
      creators: ['David Benioff', 'D. B. Weiss'],
      cast: ['Emilia Clarke'],
    });

    expect(parsed.contentRating).toBe('TV-MA');
    expect(parsed.criticScore).toBe(94);
    expect(parsed.creators).toEqual(['David Benioff', 'D. B. Weiss']);
  });

  it('rejects invalid kind', () => {
    expect(() => TitleSchema.parse({ ...base, kind: 'book' })).toThrow();
  });

  it('rejects invalid uuid id', () => {
    expect(() => TitleSchema.parse({ ...base, id: 'not-a-uuid' })).toThrow();
  });
});

describe('OfferTypeSchema', () => {
  it('accepts the four MVP offer types', () => {
    for (const o of ['subscription', 'rent', 'buy', 'free'] as const) {
      expect(OfferTypeSchema.parse(o)).toBe(o);
    }
  });
});
