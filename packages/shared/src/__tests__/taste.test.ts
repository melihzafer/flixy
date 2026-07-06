import {
  COLD_START_GENRE_PRIOR,
  TASTE_DECAY_DAYS,
  buildTasteSignal,
  withColdStartPrior,
} from '../taste';

const NOW = new Date('2026-07-06T00:00:00Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('buildTasteSignal', () => {
  it('weights directions: Top Pick > Save > Seen positive, Pass negative', () => {
    const taste = buildTasteSignal(
      [
        { direction: 'up', genres: ['action'], occurredAt: daysAgo(0) },
        { direction: 'right', genres: ['comedy'], occurredAt: daysAgo(0) },
        { direction: 'down', genres: ['drama'], occurredAt: daysAgo(0) },
        { direction: 'left', genres: ['horror'], occurredAt: daysAgo(0) },
      ],
      { now: NOW },
    );

    expect(taste.positiveGenres.action).toBeCloseTo(4);
    expect(taste.positiveGenres.comedy).toBeCloseTo(3);
    expect(taste.positiveGenres.drama).toBeCloseTo(0.5);
    expect(taste.negativeGenres.horror).toBeCloseTo(1);
    expect(taste.totalSwipes).toBe(4);
  });

  it('treats Seen (down) as a weak positive, never a dislike', () => {
    const taste = buildTasteSignal(
      [{ direction: 'down', genres: ['drama'], occurredAt: daysAgo(0) }],
      { now: NOW },
    );
    expect(taste.negativeGenres.drama).toBeUndefined();
    expect(taste.positiveGenres.drama).toBeGreaterThan(0);
    expect(taste.positiveGenres.drama).toBeLessThan(3); // weaker than a Save
  });

  it('decays old swipes: a TASTE_DECAY_DAYS-old swipe weighs 1/e of a fresh one', () => {
    const fresh = buildTasteSignal(
      [{ direction: 'right', genres: ['drama'], occurredAt: daysAgo(0) }],
      { now: NOW },
    );
    const old = buildTasteSignal(
      [{ direction: 'right', genres: ['drama'], occurredAt: daysAgo(TASTE_DECAY_DAYS) }],
      { now: NOW },
    );
    expect(old.positiveGenres.drama).toBeCloseTo((fresh.positiveGenres.drama ?? 0) / Math.E, 5);
  });

  it('recent behavior outweighs old behavior of the opposite sign', () => {
    // 3 old passes on comedy vs 1 fresh save: the save must win.
    const taste = buildTasteSignal(
      [
        { direction: 'left', genres: ['comedy'], occurredAt: daysAgo(90) },
        { direction: 'left', genres: ['comedy'], occurredAt: daysAgo(90) },
        { direction: 'left', genres: ['comedy'], occurredAt: daysAgo(90) },
        { direction: 'right', genres: ['comedy'], occurredAt: daysAgo(0) },
      ],
      { now: NOW },
    );
    const net = (taste.positiveGenres.comedy ?? 0) - (taste.negativeGenres.comedy ?? 0);
    expect(net).toBeGreaterThan(0);
  });

  it('ignores undone swipes and unknown directions', () => {
    const taste = buildTasteSignal(
      [
        { direction: 'right', genres: ['drama'], occurredAt: daysAgo(0), isUndone: true },
        { direction: 'diagonal', genres: ['drama'], occurredAt: daysAgo(0) },
      ],
      { now: NOW },
    );
    expect(taste.positiveGenres.drama).toBeUndefined();
    expect(taste.totalSwipes).toBe(0);
  });

  it('grants full weight when the timestamp is missing or invalid', () => {
    const taste = buildTasteSignal(
      [
        { direction: 'right', genres: ['drama'] },
        { direction: 'right', genres: ['comedy'], occurredAt: 'not-a-date' },
      ],
      { now: NOW },
    );
    expect(taste.positiveGenres.drama).toBeCloseTo(3);
    expect(taste.positiveGenres.comedy).toBeCloseTo(3);
  });

  it('weights trailer watches above detail opens but below save and top pick', () => {
    const taste = buildTasteSignal(
      [
        { direction: 'right', itemId: 'saved', genres: ['comedy'], occurredAt: daysAgo(0) },
        { direction: 'up', itemId: 'top', genres: ['action'], occurredAt: daysAgo(0) },
      ],
      {
        now: NOW,
        tasteEvents: [
          {
            eventId: 'detail',
            itemId: 'detail-title',
            itemType: 'movie',
            genres: ['drama'],
            occurredAt: daysAgo(0),
            eventType: 'open_details',
          },
          {
            eventId: 'trailer',
            itemId: 'trailer-title',
            itemType: 'tv',
            genres: ['sci_fi'],
            occurredAt: daysAgo(0),
            eventType: 'watch_trailer',
          },
        ],
      },
    );

    expect(taste.positiveGenres.drama).toBeCloseTo(1);
    expect(taste.positiveGenres.sci_fi).toBeCloseTo(2);
    expect(taste.positiveGenres.comedy).toBeCloseTo(3);
    expect(taste.positiveGenres.action).toBeCloseTo(4);
  });

  it('applies the same 30-day decay to local taste events', () => {
    const taste = buildTasteSignal([], {
      now: NOW,
      tasteEvents: [
        {
          eventId: 'old-detail',
          itemId: 'title',
          itemType: 'movie',
          genres: ['drama'],
          occurredAt: daysAgo(TASTE_DECAY_DAYS),
          eventType: 'open_details',
        },
      ],
    });
    expect(taste.positiveGenres.drama).toBeCloseTo(1 / Math.E, 5);
  });

  it('keeps a pass stronger than weak detail opens for the same item', () => {
    const taste = buildTasteSignal(
      [
        {
          direction: 'left',
          itemId: 'passed',
          genres: ['horror'],
          occurredAt: daysAgo(1),
        },
      ],
      {
        now: NOW,
        tasteEvents: [
          {
            eventId: 'detail-after-pass',
            itemId: 'passed',
            itemType: 'movie',
            genres: ['horror'],
            occurredAt: daysAgo(0),
            eventType: 'open_details',
          },
        ],
      },
    );
    expect(taste.positiveGenres.horror).toBeUndefined();
    expect(taste.negativeGenres.horror).toBeGreaterThan(0);
  });
});

describe('withColdStartPrior', () => {
  it('adds the prior to selected genres without mutating the input', () => {
    const base = { positiveGenres: { drama: 2 }, negativeGenres: {}, totalSwipes: 1 };
    const seeded = withColdStartPrior(base, ['drama', 'comedy']);

    expect(seeded.positiveGenres.drama).toBeCloseTo(2 + COLD_START_GENRE_PRIOR);
    expect(seeded.positiveGenres.comedy).toBeCloseTo(COLD_START_GENRE_PRIOR);
    expect(seeded.totalSwipes).toBe(1);
    expect(base.positiveGenres.drama).toBe(2);
    expect(base.positiveGenres).not.toHaveProperty('comedy');
  });

  it('returns the input unchanged for an empty selection', () => {
    const base = { positiveGenres: {}, negativeGenres: {}, totalSwipes: 0 };
    expect(withColdStartPrior(base, [])).toBe(base);
    expect(withColdStartPrior(base, null)).toBe(base);
  });
});
