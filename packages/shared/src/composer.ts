import type { DeckCard, MoodPreset, RuleTrace } from './schemas/deck';
import { MOOD_PRESETS } from './schemas/deck';
import type { TasteSignal } from './schemas/swipe';
import type { Title } from './schemas/title';

/**
 * 7-layer deck composer (FSD section 3.5.3). Pure function: takes a candidate
 * pool already pre-filtered (Layer 1 is performed by the catalogue query) plus
 * user state, returns a scored, ordered, diversity-aware deck.
 *
 * The composer runs on-device for MVP — no LLM, no server-side ranking. This
 * is deliberate: keeps the swipe loop instant + offline-tolerant. Server
 * personalization is a Phase 2 candidate; the function signature is stable.
 */

export type ComposeOptions = {
  candidates: Title[];
  taste: TasteSignal;
  ownedServiceIds: string[];
  passedRecently: Set<string>;
  shownLast7d: Set<string>;
  excludeIds: Set<string>;
  targetSize?: number;
  now?: Date;
};

export type ComposeResult = {
  cards: DeckCard[];
  isNarrow: boolean;
};

const COLD_START_THRESHOLD = 50;
const MAX_CONSECUTIVE_SAME_GENRE = 3;
const EXPLORATION_RATIO = 0.15;
const DEFAULT_TARGET_SIZE = 50;

function popularityScore(t: Title): number {
  // Normalize popularity into roughly 0..1. The catalogue stores raw values
  // up to ~1000; clamp anything higher.
  return Math.min(1, t.popularity / 1000);
}

function personalizationScore(t: Title, taste: TasteSignal): number {
  if (taste.totalSwipes === 0) return 0;
  let pos = 0;
  let neg = 0;
  for (const g of t.genres) {
    pos += taste.positiveGenres[g] ?? 0;
    neg += taste.negativeGenres[g] ?? 0;
  }
  // Normalize by total swipes so early swipes don't overpower.
  return (pos - neg) / Math.max(1, taste.totalSwipes);
}

function availabilityScore(t: Title, ownedServices: string[]): number {
  if (t.availability.length === 0) return 0;
  const owned = new Set(ownedServices);
  const onOwned = t.availability.some((a) => owned.has(a.serviceId));
  if (onOwned) return 1;
  // Soft suppress (FSD 3.5.3 Layer 4): show but demote, do not exclude.
  return -0.3;
}

function freshnessScore(t: Title, now: Date): number {
  if (t.releaseYear == null) return 0;
  const ageYears = now.getUTCFullYear() - t.releaseYear;
  if (ageYears > 1) return 0;
  // FSD says "last 90 days proportional to popularity" — without a precise
  // release-date column, approximate using current-year + popularity.
  const popBoost = popularityScore(t);
  return ageYears <= 0 ? 0.5 * popBoost : 0.2 * popBoost;
}

function cooldownScore(id: string, passedRecently: Set<string>, shown: Set<string>): number {
  if (passedRecently.has(id)) return -1;
  if (shown.has(id)) return -0.4;
  return 0;
}

function primaryGenre(t: Title): string {
  return t.genres[0] ?? 'unknown';
}

export function composeDeck(opts: ComposeOptions): ComposeResult {
  const {
    candidates,
    taste,
    ownedServiceIds,
    passedRecently,
    shownLast7d,
    excludeIds,
    targetSize = DEFAULT_TARGET_SIZE,
    now = new Date(),
  } = opts;

  // Hard exclude (Layer 1 residue): seen, watchlist, recent passes' hard list.
  const eligible = candidates.filter((t) => !excludeIds.has(t.id));

  // Cold-start weighting: popularity dominates when signal is thin.
  const isColdStart = taste.totalSwipes < COLD_START_THRESHOLD;
  const wPersonal = isColdStart ? 0.2 : 0.6;
  const wPopularity = isColdStart ? 0.6 : 0.2;
  const wAvailability = 0.3;
  const wFreshness = 0.2;
  const wCooldown = 1.0;

  const scored: Array<{ title: Title; trace: RuleTrace }> = eligible.map((t) => {
    const personalization = personalizationScore(t, taste);
    const popularity = popularityScore(t);
    const availability = availabilityScore(t, ownedServiceIds);
    const freshness = freshnessScore(t, now);
    const cooldown = cooldownScore(t.id, passedRecently, shownLast7d);
    const finalScore =
      wPersonal * personalization +
      wPopularity * popularity +
      wAvailability * availability +
      wFreshness * freshness +
      wCooldown * cooldown;
    return {
      title: t,
      trace: {
        personalization,
        popularity,
        availability,
        freshness,
        cooldown,
        exploration: false,
        finalScore,
      },
    };
  });

  // Sort by final score desc, then split into top + exploration pool.
  scored.sort((a, b) => b.trace.finalScore - a.trace.finalScore);

  const explorationCount = Math.floor(targetSize * EXPLORATION_RATIO);
  const topCount = Math.min(scored.length, targetSize - explorationCount);
  const top = scored.slice(0, topCount);

  // Exploration: deterministic stride sample from the tail to break filter
  // bubbles (FSD 3.5.3 Layer 5). Mark with `exploration: true`.
  const tail = scored.slice(topCount);
  const exploration: typeof scored = [];
  if (tail.length > 0 && explorationCount > 0) {
    const stride = Math.max(1, Math.floor(tail.length / explorationCount));
    for (let i = 0; i < tail.length && exploration.length < explorationCount; i += stride) {
      const item = tail[i];
      if (!item) continue;
      exploration.push({ title: item.title, trace: { ...item.trace, exploration: true } });
    }
  }

  // Diversity guard: no more than 3 consecutive cards in the same primary genre.
  const merged = [...top, ...exploration];
  const ordered: DeckCard[] = [];
  const remaining = [...merged];
  let lastGenre: string | null = null;
  let lastRun = 0;
  while (remaining.length > 0) {
    const idx = remaining.findIndex((c) => {
      if (lastGenre == null || lastRun < MAX_CONSECUTIVE_SAME_GENRE) return true;
      return primaryGenre(c.title) !== lastGenre;
    });
    const pickIdx = idx === -1 ? 0 : idx;
    const item = remaining.splice(pickIdx, 1)[0];
    if (!item) break;
    const g = primaryGenre(item.title);
    if (g === lastGenre) lastRun += 1;
    else {
      lastGenre = g;
      lastRun = 1;
    }
    ordered.push(item);
  }

  return {
    cards: ordered.slice(0, targetSize),
    isNarrow: ordered.length < targetSize,
  };
}

export function moodToFilter(mood: MoodPreset | null) {
  if (!mood) return {};
  return MOOD_PRESETS[mood];
}
