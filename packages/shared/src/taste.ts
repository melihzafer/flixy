import type { TasteSignal } from './schemas/swipe';
import type { TasteEvent as LocalTasteEvent, TasteEventType } from './schemas/tasteEvent';

/** The durable state of a title on the watchlist is the positive source of truth. */
export const WATCHLIST_TASTE_WEIGHTS = {
  top: 5,
  watched: 3,
  saved: 2,
} as const;

/** A pass is intentionally weaker than a positive list action but compounds. */
export const SWIPE_TASTE_WEIGHTS: Record<string, number> = {
  up: WATCHLIST_TASTE_WEIGHTS.top,
  right: WATCHLIST_TASTE_WEIGHTS.saved,
  down: WATCHLIST_TASTE_WEIGHTS.watched,
  left: -1,
};

/** A 30-day old pass contributes roughly 37% of its original suppression. */
export const TASTE_DECAY_DAYS = 30;

export const LOCAL_TASTE_EVENT_WEIGHTS: Record<TasteEventType, number> = {
  open_details: 1,
  watch_trailer: 2,
};

export const COLD_START_GENRE_PRIOR = 1.5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SwipeTasteEvent = {
  direction: string;
  itemId?: string | null;
  genres?: readonly string[] | null;
  language?: string | null;
  kind?: 'movie' | 'tv' | null;
  occurredAt?: string | null;
  isUndone?: boolean;
};

export type WatchlistTasteEntry = {
  priority: 'top' | 'normal';
  watchedAt: string | null;
  genres: readonly string[];
  language?: string | null;
  kind?: 'movie' | 'tv' | null;
};

function emptyTaste(): TasteSignal {
  return {
    positiveGenres: {},
    negativeGenres: {},
    positiveLanguages: {},
    negativeLanguages: {},
    positiveKinds: {},
    negativeKinds: {},
    totalSwipes: 0,
  };
}

function add(record: Record<string, number>, key: string | null | undefined, weight: number) {
  if (!key) return;
  const normalized = key.trim().toLowerCase();
  if (!normalized) return;
  record[normalized] = (record[normalized] ?? 0) + weight;
}

function addDimensions(
  taste: TasteSignal,
  input: Pick<SwipeTasteEvent, 'genres' | 'language' | 'kind'>,
  weight: number,
) {
  const genreTarget = weight >= 0 ? taste.positiveGenres : taste.negativeGenres;
  const languageTarget = weight >= 0 ? taste.positiveLanguages : taste.negativeLanguages;
  const kindTarget = weight >= 0 ? taste.positiveKinds : taste.negativeKinds;
  const magnitude = Math.abs(weight);
  for (const genre of input.genres ?? []) add(genreTarget, genre, magnitude);
  add(languageTarget, input.language, magnitude);
  add(kindTarget, input.kind, magnitude);
}

function decayedWeight(weight: number, occurredAt: string | null | undefined, now: Date) {
  const occurredMs = occurredAt ? new Date(occurredAt).getTime() : Number.NaN;
  const daysOld = Number.isFinite(occurredMs)
    ? Math.max(0, (now.getTime() - occurredMs) / MS_PER_DAY)
    : 0;
  return weight * Math.exp(-daysOld / TASTE_DECAY_DAYS);
}

/**
 * Builds a backwards-compatible signal from raw swipe history. Positive swipe
 * directions use the public 5/2/3 weights; callers that have a watchlist
 * should prefer buildWatchlistTasteSignal so state changes are reflected.
 */
export function buildTasteSignal(
  events: readonly SwipeTasteEvent[],
  opts: { now?: Date; tasteEvents?: readonly LocalTasteEvent[] } = {},
): TasteSignal {
  const now = opts.now ?? new Date();
  const taste = emptyTaste();
  const activePasses = new Map<string, number>();

  for (const event of events) {
    if (event.isUndone) continue;
    const weight = SWIPE_TASTE_WEIGHTS[event.direction];
    if (weight == null) continue;
    taste.totalSwipes++;
    addDimensions(taste, event, decayedWeight(weight, event.occurredAt, now));
    if (event.direction === 'left' && event.itemId) {
      const occurredMs = event.occurredAt ? new Date(event.occurredAt).getTime() : Number.NaN;
      activePasses.set(event.itemId, Number.isFinite(occurredMs) ? occurredMs : now.getTime());
    }
  }

  for (const event of opts.tasteEvents ?? []) {
    const weight = LOCAL_TASTE_EVENT_WEIGHTS[event.eventType];
    if (weight == null) continue;
    const occurredMs = new Date(event.occurredAt).getTime();
    const passMs = activePasses.get(event.itemId);
    if (passMs != null && (event.eventType === 'open_details' || occurredMs <= passMs)) continue;
    addDimensions(
      taste,
      { genres: event.genres, kind: event.itemType },
      decayedWeight(weight, event.occurredAt, now),
    );
  }
  return taste;
}

/**
 * For You's authoritative profile: current watchlist state supplies positives
 * (Top 5, Watched 3, Saved 2); only passes supply negative history. A watched
 * Top uses its highest state weight rather than being double-counted.
 */
export function buildWatchlistTasteSignal(
  watchlist: readonly WatchlistTasteEntry[],
  passes: readonly SwipeTasteEvent[],
  opts: { now?: Date } = {},
): TasteSignal {
  const taste = emptyTaste();
  for (const item of watchlist) {
    const weight =
      item.priority === 'top'
        ? WATCHLIST_TASTE_WEIGHTS.top
        : item.watchedAt
          ? WATCHLIST_TASTE_WEIGHTS.watched
          : WATCHLIST_TASTE_WEIGHTS.saved;
    taste.totalSwipes++;
    addDimensions(taste, item, weight);
  }

  const passOnly = passes.filter((event) => !event.isUndone && event.direction === 'left');
  const passSignal = buildTasteSignal(passOnly, { now: opts.now });
  taste.totalSwipes += passSignal.totalSwipes;
  for (const [key, value] of Object.entries(passSignal.negativeGenres))
    add(taste.negativeGenres, key, value);
  for (const [key, value] of Object.entries(passSignal.negativeLanguages)) {
    add(taste.negativeLanguages, key, value);
  }
  for (const [key, value] of Object.entries(passSignal.negativeKinds))
    add(taste.negativeKinds, key, value);
  return taste;
}

/** Adds the initial selected-genre prior without mutating its input. */
export function withColdStartPrior(
  taste: TasteSignal,
  selectedGenres: readonly string[] | null | undefined,
  prior: number = COLD_START_GENRE_PRIOR,
): TasteSignal {
  if (!selectedGenres || selectedGenres.length === 0) return taste;
  const positiveGenres = { ...taste.positiveGenres };
  for (const genre of selectedGenres) add(positiveGenres, genre, prior);
  return { ...taste, positiveGenres };
}
