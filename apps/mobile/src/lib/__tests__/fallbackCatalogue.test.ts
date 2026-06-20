import {
  FALLBACK_GENRES_PARSED,
  FALLBACK_STREAMING_SERVICES,
  FALLBACK_TITLES,
  normalizeGenreId,
  normalizeServiceId,
} from '../fallbackCatalogue';

describe('fallbackCatalogue', () => {
  it('normalizes legacy service labels to service ids', () => {
    expect(normalizeServiceId('Netflix')).toBe('netflix');
    expect(normalizeServiceId('Prime Video')).toBe('prime_video');
    expect(normalizeServiceId('Disney+')).toBe('disney_plus');
  });

  it('normalizes genre labels to stored ids', () => {
    expect(normalizeGenreId('Sci Fi')).toBe('sci_fi');
    expect(normalizeGenreId('Action')).toBe('action');
  });

  it('covers onboarding defaults with playable fallback titles', () => {
    const serviceIds = new Set(FALLBACK_STREAMING_SERVICES.map((service) => service.id));
    const genreIds = new Set(FALLBACK_GENRES_PARSED.map((genre) => genre.id));

    expect(serviceIds.has('netflix')).toBe(true);
    expect(genreIds.has('action')).toBe(true);
    expect(genreIds.has('drama')).toBe(true);
    expect(genreIds.has('thriller')).toBe(true);

    const playableForNewUserFlow = FALLBACK_TITLES.filter(
      (title) =>
        title.genres.some((genre) => ['action', 'drama', 'thriller'].includes(genre)) &&
        title.availability.some((offer) => offer.region === 'US' && offer.serviceId === 'netflix'),
    );

    expect(playableForNewUserFlow.length).toBeGreaterThanOrEqual(3);
  });

  it('matches the dev seed catalogue breadth', () => {
    expect(FALLBACK_TITLES).toHaveLength(21);
    expect(FALLBACK_TITLES.map((title) => title.tmdbId).sort((a, b) => a - b)).toEqual([
      12, 13, 122, 155, 424, 550, 603, 680, 1100, 1396, 1399, 1402, 1668, 27205, 60059, 60625,
      66732, 76479, 84958, 94997, 157336,
    ]);
  });

  it('covers mainstream TV search misses with real fallback metadata', () => {
    const himym = FALLBACK_TITLES.find((title) => title.title === 'How I Met Your Mother');

    expect(himym).toMatchObject({
      tmdbId: 1100,
      kind: 'tv',
      releaseYear: 2005,
      runtimeMinutes: 22,
      creators: ['Carter Bays', 'Craig Thomas'],
    });
  });
});
