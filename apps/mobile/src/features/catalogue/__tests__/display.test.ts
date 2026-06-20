import type { Title } from '@flixy/shared';

import { toTitleDisplay } from '../display';

function title(overrides: Partial<Title> = {}): Title {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tmdbId: 1399,
    kind: 'tv',
    title: 'Game of Thrones',
    originalTitle: 'Game of Thrones',
    overview: 'Noble families wage war for the Iron Throne.',
    posterUrl: null,
    backdropUrl: null,
    trailerKey: null,
    releaseYear: 2011,
    runtimeMinutes: null,
    imdbRating: 9.2,
    popularity: 990,
    genres: ['drama'],
    language: 'en',
    availability: [],
    ...overrides,
  };
}

describe('toTitleDisplay', () => {
  it('does not fabricate trust metadata when authoritative fields are absent', () => {
    const display = toTitleDisplay(title());

    expect(display.runtime).toBeNull();
    expect(display.rating).toBeNull();
    expect(display.director).toBeNull();
    expect(display.creators).toEqual([]);
    expect(display.cast).toEqual([]);
    expect(display.rt).toBeNull();
  });

  it('uses authoritative TV creators and cast when present', () => {
    const display = toTitleDisplay(
      title({
        contentRating: 'TV-MA',
        criticScore: 94,
        creators: ['David Benioff', 'D. B. Weiss'],
        cast: ['Emilia Clarke', 'Kit Harington'],
        runtimeMinutes: 60,
      }),
    );

    expect(display.runtime).toBe('1h');
    expect(display.rating).toBe('TV-MA');
    expect(display.creators).toEqual(['David Benioff', 'D. B. Weiss']);
    expect(display.cast).toEqual(['Emilia Clarke', 'Kit Harington']);
    expect(display.rt).toBe(94);
  });
});
