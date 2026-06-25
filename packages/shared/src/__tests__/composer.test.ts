import { composeDeck } from '../composer';
import type { TasteSignal, Title } from '../index';

function mkTitle(over: Partial<Title>): Title {
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

const noTaste: TasteSignal = { positiveGenres: {}, negativeGenres: {}, totalSwipes: 0 };

describe('composeDeck', () => {
  it('returns popularity-ordered deck on cold start', () => {
    const candidates = [
      mkTitle({ id: '00000000-0000-0000-0000-000000000001', popularity: 100 }),
      mkTitle({ id: '00000000-0000-0000-0000-000000000002', popularity: 900 }),
      mkTitle({ id: '00000000-0000-0000-0000-000000000003', popularity: 500 }),
    ];
    const { cards } = composeDeck({
      candidates,
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 3,
    });
    expect(cards[0]?.title.id).toBe('00000000-0000-0000-0000-000000000002');
  });

  it('respects excludeIds (Layer 1 hard exclude)', () => {
    const candidates = [
      mkTitle({ id: '00000000-0000-0000-0000-000000000001' }),
      mkTitle({ id: '00000000-0000-0000-0000-000000000002' }),
    ];
    const { cards } = composeDeck({
      candidates,
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(['00000000-0000-0000-0000-000000000001']),
    });
    expect(
      cards.find((c) => c.title.id === '00000000-0000-0000-0000-000000000001'),
    ).toBeUndefined();
  });

  it('demotes recently-passed titles via cooldown', () => {
    const passed = mkTitle({ id: '00000000-0000-0000-0000-000000000001', popularity: 1000 });
    const fresh = mkTitle({ id: '00000000-0000-0000-0000-000000000002', popularity: 200 });
    const { cards } = composeDeck({
      candidates: [passed, fresh],
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(['00000000-0000-0000-0000-000000000001']),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 2,
    });
    expect(cards[0]?.title.id).toBe('00000000-0000-0000-0000-000000000002');
  });

  it('boosts titles available on owned services', () => {
    const owned = mkTitle({
      id: '00000000-0000-0000-0000-000000000001',
      popularity: 100,
      availability: [
        {
          serviceId: 'netflix',
          region: 'US',
          offerType: 'subscription',
          deepLink: null,
          observedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const unowned = mkTitle({ id: '00000000-0000-0000-0000-000000000002', popularity: 200 });
    const { cards, diagnostics } = composeDeck({
      candidates: [owned, unowned],
      taste: noTaste,
      ownedServiceIds: ['netflix'],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 2,
    });
    expect(cards[0]?.title.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(diagnostics.candidateCount).toBe(2);
    expect(diagnostics.eligibleCount).toBe(2);
    expect(diagnostics.finalCardsCount).toBe(2);
  });

  it('marks isNarrow when pool smaller than target', () => {
    const { isNarrow, cards } = composeDeck({
      candidates: [mkTitle({})],
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 50,
    });
    expect(isNarrow).toBe(true);
    expect(cards.length).toBe(1);
  });

  it('returns an empty deck when candidates are undefined', () => {
    const { cards, isNarrow, diagnostics } = composeDeck({
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 3,
    });

    expect(cards).toEqual([]);
    expect(isNarrow).toBe(true);
    expect(diagnostics).toMatchObject({
      candidateCount: 0,
      eligibleCount: 0,
      finalCardsCount: 0,
      excludedCount: 0,
    });
  });

  it('normalizes malformed title arrays before scoring', () => {
    const malformedTitle = {
      ...mkTitle({ id: '00000000-0000-0000-0000-000000000001' }),
      availability: undefined,
      genres: undefined,
    } as unknown as Title;

    const { cards, diagnostics } = composeDeck({
      candidates: [malformedTitle],
      taste: noTaste,
      ownedServiceIds: ['netflix'],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 1,
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.title.genres).toEqual([]);
    expect(cards[0]?.title.availability).toEqual([]);
    expect(diagnostics.candidateCount).toBe(1);
  });

  it('reports exclusion diagnostics', () => {
    const { diagnostics } = composeDeck({
      candidates: [
        mkTitle({ id: '00000000-0000-0000-0000-000000000001' }),
        mkTitle({ id: '00000000-0000-0000-0000-000000000002' }),
      ],
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(['00000000-0000-0000-0000-000000000001']),
      targetSize: 2,
    });

    expect(diagnostics).toMatchObject({
      candidateCount: 2,
      eligibleCount: 1,
      finalCardsCount: 1,
      excludedCount: 1,
    });
  });

  it('breaks runs of same-genre cards (diversity)', () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      mkTitle({
        id: `00000000-0000-0000-0000-00000000000${i + 1}`,
        popularity: 1000 - i,
        genres: i < 6 ? ['drama'] : ['comedy'],
      }),
    );
    const { cards } = composeDeck({
      candidates,
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 8,
    });
    let run = 0;
    let last = '';
    for (const c of cards) {
      const g = c.title.genres[0] ?? '';
      if (g === last) run += 1;
      else {
        run = 1;
        last = g;
      }
      expect(run).toBeLessThanOrEqual(3);
    }
  });

  it('boosts personalization using recommendationScores', () => {
    const defaultTitle = mkTitle({ id: '00000000-0000-0000-0000-000000000001', popularity: 500 });
    const recommendedTitle = mkTitle({
      id: '00000000-0000-0000-0000-000000000002',
      popularity: 400,
    });

    const deckWithout = composeDeck({
      candidates: [defaultTitle, recommendedTitle],
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 2,
    });
    expect(deckWithout.cards[0]?.title.id).toBe('00000000-0000-0000-0000-000000000001');

    const deckWith = composeDeck({
      candidates: [defaultTitle, recommendedTitle],
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set(),
      shownLast7d: new Set(),
      excludeIds: new Set(),
      targetSize: 2,
      recommendationScores: {
        '00000000-0000-0000-0000-000000000002': 0.9,
      },
    });
    expect(deckWith.cards[0]?.title.id).toBe('00000000-0000-0000-0000-000000000002');
  });

  it('uses userSeed to vary otherwise tied card order', () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      mkTitle({
        id: `00000000-0000-0000-0000-00000000010${i}`,
        popularity: 500,
        genres: ['drama'],
      }),
    );

    const base = {
      candidates,
      taste: noTaste,
      ownedServiceIds: [],
      passedRecently: new Set<string>(),
      shownLast7d: new Set<string>(),
      excludeIds: new Set<string>(),
      targetSize: 8,
    };

    const first = composeDeck({ ...base, userSeed: 'user-a' }).cards.map((c) => c.title.id);
    const second = composeDeck({ ...base, userSeed: 'user-b' }).cards.map((c) => c.title.id);

    expect(first).not.toEqual(second);
  });
});
