import type { DeckCard, MoodPreset, RuleTrace, VibePreset } from './schemas/deck';
import { MOOD_PRESETS, VIBE_PRESETS } from './schemas/deck';
import type { TasteSignal } from './schemas/swipe';
import { type Title, TitleAvailabilitySchema, TitleSchema } from './schemas/title';

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
  candidates?: readonly Title[] | null;
  taste: TasteSignal;
  ownedServiceIds: string[];
  passedRecently: Set<string>;
  shownLast7d: Set<string>;
  excludeIds: Set<string>;
  targetSize?: number;
  now?: Date;
  recommendationScores?: Record<string, number>;
  userSeed?: string | null;
  /** Selected vibes; titles matching any vibe's genre cluster get a boost. */
  vibes?: readonly VibePreset[] | null;
  /** Preferred origin countries (ISO-3166 alpha-2); matching titles get a boost. */
  preferredCountries?: readonly string[] | null;
  /** "For You" mode emphasises on-device taste + remote recommendations. */
  forYou?: boolean;
};

export type ComposeResult = {
  cards: DeckCard[];
  isNarrow: boolean;
  diagnostics: {
    candidateCount: number;
    eligibleCount: number;
    finalCardsCount: number;
    excludedCount: number;
  };
};

const COLD_START_THRESHOLD = 50;
const MAX_CONSECUTIVE_SAME_GENRE = 3;
const EXPLORATION_RATIO = 0.15;
const DEFAULT_TARGET_SIZE = 50;
const VIBE_BOOST = 0.2;
const COUNTRY_BOOST = 0.2;
const FOR_YOU_BOOST = 0.12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringSet(value: unknown): Set<string> {
  if (!(value instanceof Set)) return new Set();
  return new Set([...value].filter((item): item is string => typeof item === 'string'));
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  );
}

function safeTasteSignal(value: unknown): TasteSignal {
  if (!isRecord(value)) {
    return { positiveGenres: {}, negativeGenres: {}, totalSwipes: 0 };
  }
  return {
    positiveGenres: numberRecord(value.positiveGenres),
    negativeGenres: numberRecord(value.negativeGenres),
    totalSwipes:
      typeof value.totalSwipes === 'number' && Number.isFinite(value.totalSwipes)
        ? value.totalSwipes
        : 0,
  };
}

function availabilityArray(value: unknown): Title['availability'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => TitleAvailabilitySchema.safeParse(item))
    .filter(
      (result): result is { success: true; data: Title['availability'][number] } => result.success,
    )
    .map((result) => result.data);
}

function safeTitle(value: unknown): Title | null {
  if (!isRecord(value)) return null;
  const parsed = TitleSchema.safeParse({
    ...value,
    genres: stringArray(value.genres),
    availability: availabilityArray(value.availability),
  });
  return parsed.success ? parsed.data : null;
}

function candidateArray(value: unknown): Title[] {
  if (!Array.isArray(value)) return [];
  return value.map(safeTitle).filter((title): title is Title => title !== null);
}

function popularityScore(t: Title): number {
  // Normalize popularity into roughly 0..1. The catalogue stores raw values
  // up to ~1000; clamp anything higher.
  return Math.min(1, t.popularity / 1000);
}

function personalizationScore(t: Title, taste: TasteSignal, recommendationScore?: number): number {
  let baseScore = 0;
  if (taste.totalSwipes > 0) {
    let pos = 0;
    let neg = 0;
    for (const g of t.genres) {
      pos += taste.positiveGenres[g] ?? 0;
      neg += taste.negativeGenres[g] ?? 0;
    }
    // Normalize by total swipes so early swipes don't overpower.
    baseScore = (pos - neg) / Math.max(1, taste.totalSwipes);
  }

  if (recommendationScore != null) {
    // Combine base genre preference (0.4) and specific item recommendation (0.6)
    return 0.4 * baseScore + 0.6 * recommendationScore;
  }
  return baseScore;
}

/**
 * Genre-overlap boost for selected vibes. A title matches a vibe when it
 * carries at least one of the vibe's anchor genres.
 */
function vibeScore(t: Title, vibes: readonly VibePreset[] | null | undefined): number {
  if (!vibes || vibes.length === 0) return 0;
  const titleGenres = new Set(t.genres);
  for (const vibe of vibes) {
    const filter = VIBE_PRESETS[vibe];
    if (!filter?.genres) continue;
    if (filter.genres.some((g) => titleGenres.has(g))) return VIBE_BOOST;
  }
  return 0;
}

/**
 * Origin-country affinity. TMDB `language` is the ISO-639 original language
 * (en, tr, ko, ...); we treat a known preferred country code as a language
 * prefix hint when there is no explicit country field on the title.
 */
function countryScore(t: Title, preferred: readonly string[] | null | undefined): number {
  if (!preferred || preferred.length === 0) return 0;
  const lang = (t.language ?? '').toLowerCase();
  if (!lang) return 0;
  for (const code of preferred) {
    const lower = code.toLowerCase();
    // Common ISO-639 -> ISO-3166 pairs we care about (en/us, tr/tr, ko/kr, ja/jp, hi/in, de/de, es/es, fr/fr).
    const langByCountry: Record<string, string> = {
      us: 'en',
      gb: 'en',
      tr: 'tr',
      kr: 'ko',
      jp: 'ja',
      in: 'hi',
      de: 'de',
      es: 'es',
      fr: 'fr',
      it: 'it',
      br: 'pt',
      mx: 'es',
    };
    const expectedLang = langByCountry[lower];
    if (expectedLang && lang.startsWith(expectedLang)) return COUNTRY_BOOST;
    if (lang.startsWith(lower)) return COUNTRY_BOOST;
  }
  return 0;
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

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function userJitter(titleId: string, userSeed?: string | null): number {
  if (!userSeed) return 0;
  return (hashString(`${userSeed}:${titleId}`) / 0xffffffff) * 0.015;
}

export function composeDeck(opts: ComposeOptions): ComposeResult {
  const candidates = candidateArray(opts.candidates);
  const taste = safeTasteSignal(opts.taste);
  const ownedServiceIds = stringArray(opts.ownedServiceIds);
  const passedRecently = stringSet(opts.passedRecently);
  const shownLast7d = stringSet(opts.shownLast7d);
  const excludeIds = stringSet(opts.excludeIds);
  const targetSize = opts.targetSize ?? DEFAULT_TARGET_SIZE;
  const now = opts.now ?? new Date();
  const recommendationScores = opts.recommendationScores ?? {};
  const userSeed = typeof opts.userSeed === 'string' ? opts.userSeed : null;
  const vibes = Array.isArray(opts.vibes) ? opts.vibes : null;
  const preferredCountries = Array.isArray(opts.preferredCountries)
    ? opts.preferredCountries
    : null;
  const forYou = opts.forYou === true;

  // Cold-start weighting: popularity dominates when signal is thin. In
  // "For You" mode we tilt even harder toward personalization + remote recos so
  // the deck visibly reflects the user's taste the moment they swipe in.
  const isColdStart = taste.totalSwipes < COLD_START_THRESHOLD;
  const wPersonal = isColdStart ? (forYou ? 0.35 : 0.2) : forYou ? 0.7 : 0.6;
  const wPopularity = isColdStart ? 0.6 : forYou ? 0.1 : 0.2;
  const wAvailability = 0.3;
  const wFreshness = forYou ? 0.1 : 0.2;
  const wCooldown = 1.0;
  const wVibes = 1.0;
  const wCountry = 1.0;

  // Hard exclude (Layer 1 residue): seen, watchlist, recent passes' hard list.
  const eligible = candidates.filter((t) => !excludeIds.has(t.id));

  const scored: Array<{ title: Title; trace: RuleTrace }> = eligible.map((t) => {
    const personalization = personalizationScore(t, taste, recommendationScores[t.id]);
    const popularity = popularityScore(t);
    const availability = availabilityScore(t, ownedServiceIds);
    const freshness = freshnessScore(t, now);
    const cooldown = cooldownScore(t.id, passedRecently, shownLast7d);
    const vibe = vibeScore(t, vibes);
    const country = countryScore(t, preferredCountries);
    const forYouBoost = forYou && taste.totalSwipes > 0 ? FOR_YOU_BOOST : 0;
    const finalScore =
      wPersonal * personalization +
      wPopularity * popularity +
      wAvailability * availability +
      wFreshness * freshness +
      wCooldown * cooldown +
      wVibes * vibe +
      wCountry * country +
      forYouBoost +
      userJitter(t.id, userSeed);
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
    diagnostics: {
      candidateCount: candidates.length,
      eligibleCount: eligible.length,
      finalCardsCount: Math.min(ordered.length, targetSize),
      excludedCount: candidates.length - eligible.length,
    },
  };
}

export function moodToFilter(mood: MoodPreset | null) {
  if (!mood) return {};
  return MOOD_PRESETS[mood];
}
