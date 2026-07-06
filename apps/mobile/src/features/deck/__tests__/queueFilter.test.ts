import type { DeckCard, Title } from '@flixy/shared';

import { filterRemainingCards } from '../queueFilter';

function mkCard(id: string): DeckCard {
  const title: Title = {
    id,
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
  };
  return {
    title,
    trace: {
      personalization: 0,
      popularity: 0.5,
      availability: 0,
      freshness: 0,
      cooldown: 0,
      exploration: false,
      source: 'personalized',
      positiveFactors: [],
      negativeFactors: [],
      finalScore: 0.5,
    },
  };
}

const a = mkCard('id-a');
const b = mkCard('id-b');
const c = mkCard('id-c');

describe('filterRemainingCards', () => {
  it('keeps queued cards that are neither swiped nor excluded', () => {
    const out = filterRemainingCards([a, b, c], new Set(), new Set(), new Set());
    expect(out.map((x) => x.title.id)).toEqual(['id-a', 'id-b', 'id-c']);
  });

  it('hides cards swiped this session', () => {
    const out = filterRemainingCards([a, b, c], new Set(['id-b']), new Set(), new Set());
    expect(out.map((x) => x.title.id)).toEqual(['id-a', 'id-c']);
  });

  it('drops a queued card once it lands in the exclusion set (e.g. saved from search)', () => {
    const out = filterRemainingCards([a, b, c], new Set(), new Set(['id-c']), new Set());
    expect(out.map((x) => x.title.id)).toEqual(['id-a', 'id-b']);
  });

  it('does NOT drop an excluded card the user touched this session (undo path)', () => {
    // id-b was swiped then undone: it is out of swipedIds, still present in
    // the (stale) exclusion set, and in touchedIds. It must reappear.
    const out = filterRemainingCards([a, b, c], new Set(), new Set(['id-b']), new Set(['id-b']));
    expect(out.map((x) => x.title.id)).toEqual(['id-a', 'id-b', 'id-c']);
  });

  it('swiped wins over touched (a committed swipe stays hidden)', () => {
    const out = filterRemainingCards(
      [a, b],
      new Set(['id-a']),
      new Set(['id-a']),
      new Set(['id-a']),
    );
    expect(out.map((x) => x.title.id)).toEqual(['id-b']);
  });
});
