import type { TasteSignal } from './schemas/swipe';
import type { TasteEvent as LocalTasteEvent, TasteEventType } from './schemas/tasteEvent';

/**
 * Taste signal builder — turns raw swipe history into the weighted,
 * time-decayed genre profile consumed by the deck composer.
 *
 * Pure and platform-free so the mobile app (and any future server ranker)
 * share one definition of "what a swipe means".
 */

/**
 * Signal weight per swipe direction.
 *
 * - up    = Top Pick   → strongest positive
 * - right = Save       → strong positive
 * - down  = Seen       → WEAK positive. The user chose to watch this title;
 *                        marking it watched is not a dislike. (It used to be
 *                        counted as a hard negative, which poisoned the genre
 *                        profile of anyone who honestly triaged their history.)
 * - left  = Pass       → mild negative (a skip, not an explicit "never again")
 */
export const SWIPE_TASTE_WEIGHTS: Record<string, number> = {
  up: 4,
  right: 3,
  down: 0.5,
  left: -1,
};

/** e-folding time for swipe influence: a 30-day-old swipe weighs 1/e ≈ 37%. */
export const TASTE_DECAY_DAYS = 30;

export const LOCAL_TASTE_EVENT_WEIGHTS: Record<TasteEventType, number> = {
  open_details: 1,
  watch_trailer: 2,
};

/**
 * Positive weight granted to each onboarding-selected genre so brand-new
 * users get genre-aware ranking instead of pure popularity. Swipes accumulate
 * decayed weights of 1–4 each, so a handful of real interactions quickly
 * outweighs the prior.
 */
export const COLD_START_GENRE_PRIOR = 1.5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SwipeTasteEvent = {
  direction: string;
  itemId?: string | null;
  genres?: readonly string[] | null;
  /** ISO timestamp of the swipe; missing/invalid timestamps get full weight. */
  occurredAt?: string | null;
  isUndone?: boolean;
};

/**
 * Build a weighted, time-decayed taste signal from swipe events.
 *
 * decayedWeight = |directionWeight| * exp(-daysOld / TASTE_DECAY_DAYS)
 *
 * Positive-direction weights accumulate into `positiveGenres`, negative into
 * `negativeGenres` — the composer subtracts the buckets, so the shape stays
 * byte-compatible with the previous count-based signal.
 */
export function buildTasteSignal(
  events: readonly SwipeTasteEvent[],
  opts: { now?: Date; tasteEvents?: readonly LocalTasteEvent[] } = {},
): TasteSignal {
  const now = opts.now ?? new Date();
  const positiveGenres: Record<string, number> = {};
  const negativeGenres: Record<string, number> = {};
  let totalSwipes = 0;

  for (const event of events) {
    if (event.isUndone) continue;
    const weight = SWIPE_TASTE_WEIGHTS[event.direction];
    if (weight == null) continue;
    totalSwipes++;
    if (!event.genres || event.genres.length === 0) continue;

    const occurredMs = event.occurredAt ? new Date(event.occurredAt).getTime() : Number.NaN;
    const daysOld = Number.isFinite(occurredMs)
      ? Math.max(0, (now.getTime() - occurredMs) / MS_PER_DAY)
      : 0;
    const decayed = Math.abs(weight) * Math.exp(-daysOld / TASTE_DECAY_DAYS);

    const bucket = weight >= 0 ? positiveGenres : negativeGenres;
    for (const genre of event.genres) {
      bucket[genre] = (bucket[genre] ?? 0) + decayed;
    }
  }

  const activePasses = new Map<string, number>();
  for (const event of events) {
    if (event.isUndone || event.direction !== 'left' || !event.itemId) continue;
    const occurredMs = event.occurredAt ? new Date(event.occurredAt).getTime() : Number.NaN;
    activePasses.set(event.itemId, Number.isFinite(occurredMs) ? occurredMs : now.getTime());
  }

  for (const event of opts.tasteEvents ?? []) {
    const weight = LOCAL_TASTE_EVENT_WEIGHTS[event.eventType];
    if (weight == null || event.genres.length === 0) continue;
    const occurredMs = new Date(event.occurredAt).getTime();
    const passMs = activePasses.get(event.itemId);
    // A detail open never reverses an explicit pass. A later trailer watch is
    // deliberate enough to override the earlier weak dislike.
    if (
      passMs != null &&
      (event.eventType === 'open_details' || !Number.isFinite(occurredMs) || occurredMs <= passMs)
    ) {
      continue;
    }
    const daysOld = Number.isFinite(occurredMs)
      ? Math.max(0, (now.getTime() - occurredMs) / MS_PER_DAY)
      : 0;
    const decayed = weight * Math.exp(-daysOld / TASTE_DECAY_DAYS);
    for (const genre of event.genres) {
      positiveGenres[genre] = (positiveGenres[genre] ?? 0) + decayed;
    }
  }

  return { positiveGenres, negativeGenres, totalSwipes };
}

/**
 * Merge the onboarding genre selection into a taste signal as a fixed positive
 * prior. Returns a new object; the input is not mutated. `totalSwipes` is left
 * untouched so cold-start weighting (popularity-dominant) still applies until
 * the user has really swiped.
 */
export function withColdStartPrior(
  taste: TasteSignal,
  selectedGenres: readonly string[] | null | undefined,
  prior: number = COLD_START_GENRE_PRIOR,
): TasteSignal {
  if (!selectedGenres || selectedGenres.length === 0) return taste;
  const positiveGenres = { ...taste.positiveGenres };
  for (const genre of selectedGenres) {
    positiveGenres[genre] = (positiveGenres[genre] ?? 0) + prior;
  }
  return { ...taste, positiveGenres };
}
