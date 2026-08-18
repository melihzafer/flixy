import type { Title, WatchlistItem } from '@flixy/shared';

import {
  aggregateGroupVotes,
  filterWatchlistCandidates,
  normalizePickBudget,
  rankTonightCandidates,
} from '../planner';

function title(id: string, overrides: Partial<Title> = {}): Title {
  return {
    id: `00000000-0000-4000-a000-${id.padStart(12, '0')}`,
    tmdbId: Number(id),
    kind: 'movie',
    title: `Title ${id}`,
    originalTitle: null,
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    trailerKey: null,
    releaseYear: 2024,
    runtimeMinutes: 110,
    contentRating: null,
    imdbRating: 7,
    criticScore: null,
    popularity: 100,
    genres: ['drama'],
    language: 'en',
    availability: [],
    ...overrides,
  };
}

function item(id: string, overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    id: `00000000-0000-4000-b000-${id.padStart(12, '0')}`,
    userId: '00000000-0000-4000-c000-000000000001',
    titleId: `00000000-0000-4000-a000-${id.padStart(12, '0')}`,
    priority: 'normal',
    position: Number(id),
    addedAt: '2026-01-01T00:00:00.000Z',
    watchedAt: null,
    removedAt: null,
    ...overrides,
  };
}

function candidate(
  id: string,
  overrides: Partial<Title> = {},
  itemOverrides: Partial<WatchlistItem> = {},
) {
  return { title: title(id, overrides), item: item(id, itemOverrides) };
}

describe('watchlist planner', () => {
  it('filters watched, kind, runtime, and service context', () => {
    const candidates = [
      candidate('1', { kind: 'movie', runtimeMinutes: 90, availability: [] }),
      candidate('2', {
        kind: 'tv',
        runtimeMinutes: 45,
        availability: [
          {
            serviceId: 'netflix',
            region: 'US',
            offerType: 'subscription',
            deepLink: null,
            observedAt: '2026-01-01',
          },
        ],
      }),
      candidate('3', { runtimeMinutes: 180 }, { watchedAt: '2026-01-02T00:00:00.000Z' }),
    ];

    const result = filterWatchlistCandidates(candidates, {
      kind: 'tv',
      runtime: 'short',
      serviceId: 'netflix',
    });

    expect(result.map((entry) => entry.title.id)).toEqual([candidates[1]?.title.id]);
  });

  it('ranks deterministically with top priority before popularity', () => {
    const candidates = [
      candidate('1', { imdbRating: 9.8, popularity: 800 }),
      candidate('2', { imdbRating: 6.2, popularity: 10 }, { priority: 'top' }),
      candidate('3', { imdbRating: 8.2, popularity: 200 }),
    ];

    const first = rankTonightCandidates(candidates, { kind: 'all', runtime: 'any' });
    const second = rankTonightCandidates(candidates, { kind: 'all', runtime: 'any' });

    expect(first.map((entry) => entry.title.id)).toEqual(second.map((entry) => entry.title.id));
    expect(first[0]?.item.priority).toBe('top');
  });

  it('normalizes the supported pick budgets', () => {
    expect(normalizePickBudget(2)).toBe(3);
    expect(normalizePickBudget(5)).toBe(5);
    expect(normalizePickBudget(99)).toBe(7);
  });

  it('limits each participant and ranks shared matches first', () => {
    const candidates = [candidate('1'), candidate('2'), candidate('3'), candidate('4')];
    const [firstId, secondId, thirdId, fourthId] = candidates.map((entry) => entry.title.id);
    if (!firstId || !secondId || !thirdId || !fourthId)
      throw new Error('Expected four candidate ids');
    const result = aggregateGroupVotes(
      candidates,
      [
        { participantId: 'a', titleId: firstId, direction: 'right' },
        { participantId: 'a', titleId: secondId, direction: 'right' },
        { participantId: 'a', titleId: thirdId, direction: 'right' },
        { participantId: 'a', titleId: fourthId, direction: 'right' },
        { participantId: 'b', titleId: firstId, direction: 'right' },
        { participantId: 'b', titleId: secondId, direction: 'left' },
      ],
      2,
      3,
    );

    expect(result.map((entry) => [entry.title.id, entry.voteCount])).toEqual([
      [firstId, 2],
      [secondId, 1],
      [thirdId, 1],
    ]);
    expect(result[0]?.label).toBe('match');
    expect(result[1]?.label).toBe('one_person_pick');
  });

  it('returns no results for an empty pool', () => {
    expect(aggregateGroupVotes([], [], 2, 5)).toEqual([]);
  });
});
