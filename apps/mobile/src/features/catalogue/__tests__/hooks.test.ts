import type { Title } from '@flixy/shared';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  init: jest.fn(),
}));

jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: jest.fn() },
}));

import { normalizeTitleQueryData } from '../hooks';

function mkTitle(over: Partial<Title> = {}): Title {
  return {
    id: over.id ?? '00000000-0000-0000-0000-000000000001',
    tmdbId: 1,
    kind: 'movie',
    title: 't',
    originalTitle: 't',
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    trailerKey: null,
    releaseYear: 2020,
    runtimeMinutes: 100,
    imdbRating: 7,
    popularity: 500,
    genres: ['drama'],
    language: 'en',
    availability: [],
    ...over,
  };
}

describe('normalizeTitleQueryData', () => {
  it('converts legacy persisted title arrays to the current query result shape', () => {
    const result = normalizeTitleQueryData([mkTitle()], { limit: 5 });

    expect(result.titles).toHaveLength(1);
    expect(result.diagnostics).toMatchObject({
      candidateCount: 1,
      isFallback: false,
      fallbackReason: null,
    });
  });

  it('normalizes malformed title array fields from persisted cache', () => {
    const malformedTitle = {
      ...mkTitle(),
      availability: undefined,
      genres: undefined,
    } as unknown as Title;

    const result = normalizeTitleQueryData(
      { titles: [malformedTitle], diagnostics: {} },
      { limit: 5 },
    );

    expect(result.titles[0]?.genres).toEqual([]);
    expect(result.titles[0]?.availability).toEqual([]);
    expect(result.diagnostics.candidateCount).toBe(1);
  });
});
