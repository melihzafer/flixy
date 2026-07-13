import type { Title } from '@flixy/shared';

import { resolveDeckFilterPolicy, titleMatchesDeckPolicy } from '../filterPolicy';

function title(overrides: Partial<Title> = {}): Title {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    tmdbId: 1,
    kind: 'movie',
    title: 'Test title',
    originalTitle: null,
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    trailerKey: null,
    releaseYear: 2024,
    runtimeMinutes: 110,
    imdbRating: null,
    popularity: 100,
    genres: ['drama'],
    language: 'en',
    availability: [
      {
        serviceId: 'netflix',
        region: 'US',
        offerType: 'subscription',
        deepLink: null,
        observedAt: '2026-07-14T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

const defaults = {
  selectedGenres: ['drama'],
  excludedGenres: ['animation'],
  preferredLanguages: [],
  excludedLanguages: ['hi'],
  selectedServices: ['netflix'],
};

const session = {
  kinds: ['movie', 'tv'] as Array<'movie' | 'tv'>,
  serviceIds: null,
  genres: null,
  excludedGenres: null,
  languages: null,
  excludedLanguages: null,
  minYear: null,
  maxYear: null,
  minRuntime: null,
  maxRuntime: null,
  originCountryLanguage: null,
};

describe('deck filter policy', () => {
  it('uses the primary genre for inclusion and rejects a blocked secondary genre', () => {
    const policy = resolveDeckFilterPolicy(defaults, session);

    expect(titleMatchesDeckPolicy(title({ genres: ['drama', 'romance'] }), policy)).toBe(true);
    expect(titleMatchesDeckPolicy(title({ genres: ['comedy', 'drama'] }), policy)).toBe(false);
    expect(titleMatchesDeckPolicy(title({ genres: ['drama', 'animation'] }), policy)).toBe(false);
  });

  it('enforces service, language, type, release, and runtime rules after candidates are merged', () => {
    const policy = resolveDeckFilterPolicy(defaults, {
      ...session,
      kinds: ['movie'],
      languages: ['en'],
      minYear: 2020,
      maxYear: 2025,
      minRuntime: 90,
      maxRuntime: 130,
    });

    expect(titleMatchesDeckPolicy(title(), policy)).toBe(true);
    expect(titleMatchesDeckPolicy(title({ kind: 'tv' }), policy)).toBe(false);
    expect(titleMatchesDeckPolicy(title({ language: 'hi' }), policy)).toBe(false);
    expect(titleMatchesDeckPolicy(title({ releaseYear: 2019 }), policy)).toBe(false);
    expect(titleMatchesDeckPolicy(title({ runtimeMinutes: 131 }), policy)).toBe(false);
    expect(titleMatchesDeckPolicy(title({ availability: [] }), policy)).toBe(false);
  });

  it('keeps saved blocks when a session filter replaces saved inclusions', () => {
    const policy = resolveDeckFilterPolicy(defaults, {
      ...session,
      genres: ['comedy'],
      excludedGenres: ['horror'],
    });

    expect(policy.includeGenres).toEqual(['comedy']);
    expect(policy.excludeGenres).toEqual(['animation', 'horror']);
  });
});
