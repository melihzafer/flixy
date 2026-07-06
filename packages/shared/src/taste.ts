import type { TasteSignal } from './schemas/swipe';

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

/**
 * Positive weight granted to each onboarding-selected genre so brand-new
 * users get genre-aware ranking instead of pure popularity. Swipes accumulate
 * decayed weights of 1–4 each, so a handful of real interactions quickly
 * outweighs the prior.
 */
export const COLD_START_GENRE_PRIOR = 1.5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TasteEvent = {
  direction: string;
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
  events: readonly TasteEvent[],
  opts: { now?: Date } = {},
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
