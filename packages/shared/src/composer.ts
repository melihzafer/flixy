import type { DeckCard, DeckCardSource, MoodPreset, RuleTrace, VibePreset } from './schemas/deck';
import { MOOD_PRESETS, VIBE_PRESETS } from './schemas/deck';
import {
  type PassedTitleProfile,
  PassedTitleProfileSchema,
  type TasteSignal,
} from './schemas/swipe';
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
  /** Metadata from passed titles; ids remain hard-excluded only via excludeIds. */
  passedTitleProfiles?: readonly PassedTitleProfile[] | null;
};

export type ComposeResult = {
  cards: DeckCard[];
  isNarrow: boolean;
  diagnostics: {
    candidateCount: number;
    eligibleCount: number;
    finalCardsCount: number;
    excludedCount: number;
    /** Candidate id -> applicable hard/recency exclusion reasons. */
    exclusions: Record<string, string[]>;
    /** How many final cards each feed-mix slice contributed (explainability). */
    sources: Record<DeckCardSource, number>;
  };
};

const COLD_START_THRESHOLD = 6;
const MAX_CONSECUTIVE_SAME_GENRE = 3;
const DEFAULT_TARGET_SIZE = 50;

/**
 * Feed mix slot pattern, repeated every 10 positions: 7 personalized,
 * 1 trending, 1 fresh, 1 exploration — i.e. 70/10/10/10.
 * Unlisted positions are personalized. When a slice has nothing left the slot
 * falls back to personalized, so small pools degrade gracefully to pure
 * score order (which keeps decks of <4 cards byte-identical to the old
 * behavior).
 */
const MIX_SLOT_PATTERN: Record<number, DeckCardSource> = {
  7: 'trending',
  8: 'fresh',
  9: 'exploration',
};
/** A title is "fresh" when released this year or the previous one. */
const FRESH_WINDOW_YEARS = 1;
const EXPLORATION_RATIO = 0.1;
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

function recommendationScoreRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1]),
      )
      .map(([id, score]) => [id, Math.max(0, Math.min(1, score))]),
  );
}

function safeTasteSignal(value: unknown): TasteSignal {
  if (!isRecord(value)) {
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
  return {
    positiveGenres: numberRecord(value.positiveGenres),
    negativeGenres: numberRecord(value.negativeGenres),
    positiveLanguages: numberRecord(value.positiveLanguages),
    negativeLanguages: numberRecord(value.negativeLanguages),
    positiveKinds: numberRecord(value.positiveKinds),
    negativeKinds: numberRecord(value.negativeKinds),
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

function passedTitleProfileArray(value: unknown): PassedTitleProfile[] {
  if (!Array.isArray(value)) return [];
  const profiles: PassedTitleProfile[] = [];
  for (const item of value) {
    const parsed = PassedTitleProfileSchema.safeParse(item);
    if (parsed.success) profiles.push(parsed.data);
  }
  return profiles;
}

function popularityScore(t: Title): number {
  // Normalize popularity into roughly 0..1. The catalogue stores raw values
  // up to ~1000; clamp anything higher.
  return Math.min(1, t.popularity / 1000);
}

function affinity(
  values: readonly string[],
  positive: Record<string, number>,
  negative: Record<string, number>,
): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) {
    const pos = positive[value] ?? 0;
    const neg = negative[value] ?? 0;
    // Scale-free affinity keeps three focused passes meaningful even after a
    // long, unrelated swipe history.
    sum += (pos - neg) / (pos + neg + 1);
  }
  return sum / values.length;
}

/**
 * Taste-based score in [-2, 2] for a single title. Exported so lighter
 * personalized surfaces (the trailers For You feed) can rank candidates
 * without running the full deck composer.
 */
export function personalizationScore(
  t: Title,
  taste: TasteSignal,
  recommendationScore?: number,
): number {
  const genre = affinity(t.genres, taste.positiveGenres, taste.negativeGenres);
  const language = affinity(
    t.language ? [t.language] : [],
    taste.positiveLanguages,
    taste.negativeLanguages,
  );
  const kind = affinity([t.kind], taste.positiveKinds, taste.negativeKinds);
  // Genre is the strongest content signal, while language and type stop Hindi
  // and all-series feeds from recurring after the user repeatedly rejects them.
  const baseScore = Math.max(-2, Math.min(2, 1.25 * genre + 0.5 * language + 0.25 * kind));
  return recommendationScore != null ? 0.55 * baseScore + 0.45 * recommendationScore : baseScore;
}

/**
 * A shared genre is the strongest style signal, followed by language and kind.
 * The maximum per-profile score makes repeated copies of the same pass
 * deterministic and bounded; repeated passes are represented separately by
 * the decayed taste signal and dominant-dislike eligibility rule.
 */
const PASS_SIMILARITY_GENRE_WEIGHT = 0.55;
const PASS_SIMILARITY_LANGUAGE_WEIGHT = 0.3;
const PASS_SIMILARITY_KIND_WEIGHT = 0.15;
const PASS_SIMILARITY_PENALTY_WEIGHT = 1.25;

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function passSimilarity(t: Title, profiles: readonly PassedTitleProfile[]): number {
  if (profiles.length === 0) return 0;
  const titleGenres = new Set(t.genres.map(normalized).filter(Boolean));
  const titleLanguage = normalized(t.language);
  let strongest = 0;

  for (const profile of profiles) {
    const profileGenres = profile.genres.map(normalized).filter(Boolean);
    const sharesGenre = profileGenres.some((genre) => titleGenres.has(genre));
    const sharesLanguage =
      Boolean(titleLanguage) &&
      Boolean(normalized(profile.language)) &&
      titleLanguage === normalized(profile.language);
    const sharesKind = profile.kind != null && profile.kind === t.kind;
    const similarity =
      (sharesGenre ? PASS_SIMILARITY_GENRE_WEIGHT : 0) +
      (sharesLanguage ? PASS_SIMILARITY_LANGUAGE_WEIGHT : 0) +
      (sharesKind ? PASS_SIMILARITY_KIND_WEIGHT : 0);
    strongest = Math.max(strongest, similarity);
  }
  return strongest;
}

const DISLIKED_SIGNAL_THRESHOLD = 2.5;
export const DISLIKED_GENRE_MIN_NEGATIVE = DISLIKED_SIGNAL_THRESHOLD;
export const DISLIKED_GENRE_DOMINANCE = 2;

/**
 * Exclude a candidate when a decayed negative signal reaches 2.5 and is more
 * than 2x its positive signal. Three fresh left swipes (weight 1 each) meet
 * the threshold; mixed-genre titles remain eligible when any genre is not
 * dominantly disliked.
 */

function isDominantlyDisliked(
  value: string | null | undefined,
  positive: Record<string, number>,
  negative: Record<string, number>,
): boolean {
  const key = value?.trim().toLowerCase();
  if (!key) return false;
  const neg = negative[key] ?? 0;
  const pos = positive[key] ?? 0;
  return neg >= DISLIKED_SIGNAL_THRESHOLD && neg > pos * DISLIKED_GENRE_DOMINANCE;
}

/** Genres whose decayed negative signal clearly dominates positives. */
export function dislikedGenres(taste: TasteSignal): Set<string> {
  return new Set(
    Object.keys(taste.negativeGenres).filter((genre) =>
      isDominantlyDisliked(genre, taste.positiveGenres, taste.negativeGenres),
    ),
  );
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
  const currentYear = now.getUTCFullYear();
  if (t.releaseYear > currentYear) return 0;
  const ageYears = currentYear - t.releaseYear;
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

/**
 * Deterministic per-(seed, title) jitter in [0, USER_JITTER_SCALE). Sized to
 * re-shuffle near-tied cards (TMDB page-1 titles frequently clamp to the same
 * popularity score) without ever overturning a real preference gap —
 * personalization/availability/cooldown contributions are all ≥ 0.1.
 * The seed carries a per-app-launch salt upstream, so each open deals a
 * visibly different arrangement while staying stable within the session.
 */
const USER_JITTER_SCALE = 0.05;

function userJitter(titleId: string, userSeed?: string | null): number {
  if (!userSeed) return 0;
  return (hashString(`${userSeed}:${titleId}`) / 0xffffffff) * USER_JITTER_SCALE;
}

type ScoredCandidate = { title: Title; trace: RuleTrace; passSimilarity: number };

function rankedFactors(
  factors: Array<{ factor: string; contribution: number }>,
  sign: 'positive' | 'negative',
) {
  return factors
    .filter(({ contribution }) => (sign === 'positive' ? contribution > 0 : contribution < 0))
    .sort((a, b) =>
      sign === 'positive' ? b.contribution - a.contribution : a.contribution - b.contribution,
    )
    .slice(0, 3);
}

function tagged(item: ScoredCandidate, source: DeckCardSource): ScoredCandidate {
  return {
    title: item.title,
    passSimilarity: item.passSimilarity,
    trace: { ...item.trace, exploration: source === 'exploration', source },
  };
}

/** Deterministic evenly-spaced sample of up to `count` items. */
function strideSample<T>(pool: readonly T[], count: number): T[] {
  if (pool.length === 0 || count <= 0) return [];
  const stride = Math.max(1, Math.floor(pool.length / count));
  const out: T[] = [];
  for (let i = 0; i < pool.length && out.length < count; i += stride) {
    const item = pool[i];
    if (item) out.push(item);
  }
  return out;
}

/**
 * Interleave the scored candidates into the 60/20/10/10 feed mix. Fully
 * deterministic: every pool has a fixed order and the slot pattern is fixed,
 * so the same inputs always produce the same deck.
 */
function mixFeed(scored: ScoredCandidate[], targetSize: number, now: Date): ScoredCandidate[] {
  const targetCount = Math.min(targetSize, scored.length);
  if (targetCount === 0) return [];

  const byId = (a: ScoredCandidate, b: ScoredCandidate) => (a.title.id < b.title.id ? -1 : 1);
  // Trending/fresh/exploration slots must not become a side door for genres
  // the user is actively rejecting: a disliked-genre blockbuster used to walk
  // straight back in through the popularity-sorted trending pool (2 of every
  // 10 cards), and exploration sampled the BOTTOM of the score order — which
  // is exactly where disliked titles sit. Restrict all three slices to
  // non-negative personalization and no pass-similarity penalty; the
  // personalized backbone still carries whatever the pool has left.
  const tasteEligible = scored.filter(
    (c) => c.trace.personalization >= 0 && c.passSimilarity === 0,
  );
  const byPopularity = [...tasteEligible].sort(
    (a, b) => b.title.popularity - a.title.popularity || byId(a, b),
  );
  const currentYear = now.getUTCFullYear();
  const freshPool = byPopularity.filter(
    (c) => c.title.releaseYear != null && c.title.releaseYear >= currentYear - FRESH_WINDOW_YEARS,
  );
  // Exploration samples the lower half of the (taste-eligible) score order —
  // titles the user would otherwise never reach — to break filter bubbles.
  const explorationPool = strideSample(
    tasteEligible.slice(Math.floor(tasteEligible.length / 2)),
    Math.max(1, Math.ceil(targetCount * EXPLORATION_RATIO)),
  );

  const pools: Record<DeckCardSource, ScoredCandidate[]> = {
    personalized: scored,
    trending: byPopularity,
    fresh: freshPool,
    exploration: explorationPool,
  };
  const cursors: Record<DeckCardSource, number> = {
    personalized: 0,
    trending: 0,
    fresh: 0,
    exploration: 0,
  };
  const chosen = new Set<string>();

  const next = (source: DeckCardSource): ScoredCandidate | null => {
    const pool = pools[source];
    let i = cursors[source];
    while (i < pool.length) {
      const item = pool[i];
      i++;
      if (item && !chosen.has(item.title.id)) {
        cursors[source] = i;
        chosen.add(item.title.id);
        return tagged(item, source);
      }
    }
    cursors[source] = i;
    return null;
  };

  const result: ScoredCandidate[] = [];
  for (let position = 0; position < targetCount; position++) {
    const preferred = MIX_SLOT_PATTERN[position % 10] ?? 'personalized';
    const item = next(preferred) ?? next('personalized') ?? next('trending');
    if (!item) break;
    result.push(item);
  }
  return result;
}

/**
 * Prevent an API popularity skew from producing an all-movie or all-series
 * deck. The user's positive kind signal picks the target ratio, but both kinds
 * retain a 30% floor whenever both are available.
 */
function balanceKinds(
  mixed: ScoredCandidate[],
  scored: ScoredCandidate[],
  targetSize: number,
): ScoredCandidate[] {
  const availableMovies = scored.filter((candidate) => candidate.title.kind === 'movie');
  const availableTv = scored.filter((candidate) => candidate.title.kind === 'tv');
  if (availableMovies.length === 0 || availableTv.length === 0 || targetSize < 4) return mixed;

  const targetCount = Math.min(targetSize, scored.length);
  const floor = Math.ceil(targetCount * 0.3);
  const result = [...mixed];
  const chosen = new Set(result.map((candidate) => candidate.title.id));
  const count = (kind: 'movie' | 'tv') =>
    result.filter((candidate) => candidate.title.kind === kind).length;

  const fill = (neededKind: 'movie' | 'tv') => {
    while (count(neededKind) < floor) {
      const replacementIndex = result.findIndex((candidate) => candidate.title.kind !== neededKind);
      const replacement = (neededKind === 'movie' ? availableMovies : availableTv).find(
        (candidate) => !chosen.has(candidate.title.id),
      );
      if (replacementIndex === -1 || !replacement) break;
      const removed = result[replacementIndex];
      if (removed) chosen.delete(removed.title.id);
      chosen.add(replacement.title.id);
      result[replacementIndex] = tagged(replacement, 'personalized');
    }
  };

  fill('movie');
  fill('tv');
  return result;
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
  const recommendationScores = recommendationScoreRecord(opts.recommendationScores);
  const userSeed = typeof opts.userSeed === 'string' ? opts.userSeed : null;
  const vibes = Array.isArray(opts.vibes) ? opts.vibes : null;
  const preferredCountries = Array.isArray(opts.preferredCountries)
    ? opts.preferredCountries
    : null;
  const forYou = opts.forYou === true;
  const passedTitleProfiles = passedTitleProfileArray(opts.passedTitleProfiles);

  // Cold-start weighting: popularity dominates when signal is thin. In
  // "For You" mode we tilt even harder toward personalization + remote recos so
  // the deck visibly reflects the user's taste the moment they swipe in.
  const isColdStart = taste.totalSwipes < COLD_START_THRESHOLD;
  const wPersonal = isColdStart ? (forYou ? 0.6 : 0.2) : forYou ? 0.75 : 0.6;
  const wPopularity = isColdStart ? (forYou ? 0.3 : 0.6) : forYou ? 0.1 : 0.2;
  const wAvailability = 0.3;
  const wFreshness = forYou ? 0.1 : 0.2;
  const wCooldown = 1.0;
  const wVibes = 1.0;
  const wCountry = 1.0;

  // Hard exclude (Layer 1 residue): seen, watchlist, recent passes' hard list.
  // Passed profiles add a soft similarity penalty below; they do not become
  // hard exclusions unless their exact ids are also present in excludeIds.
  const exclusions: Record<string, string[]> = {};
  const eligible = candidates.filter((t) => {
    if (excludeIds.has(t.id)) {
      const reasons = ['exclude_ids'];
      if (passedRecently.has(t.id)) reasons.push('passed_recently');
      if (shownLast7d.has(t.id)) reasons.push('shown_last_7d');
      exclusions[t.id] = reasons;
      return false;
    }

    const everyGenreDisliked =
      t.genres.length > 0 &&
      t.genres.every((genre) =>
        isDominantlyDisliked(genre, taste.positiveGenres, taste.negativeGenres),
      );
    const languageDisliked = isDominantlyDisliked(
      t.language,
      taste.positiveLanguages,
      taste.negativeLanguages,
    );
    if (everyGenreDisliked || languageDisliked) {
      const reasons: string[] = [];
      if (everyGenreDisliked) reasons.push('disliked_genres');
      if (languageDisliked) reasons.push('disliked_language');
      exclusions[t.id] = reasons;
      return false;
    }
    return true;
  });

  const scored: ScoredCandidate[] = eligible.map((t) => {
    const personalization = personalizationScore(t, taste, recommendationScores[t.id]);
    const popularity = popularityScore(t);
    const availability = availabilityScore(t, ownedServiceIds);
    const freshness = freshnessScore(t, now);
    const cooldown = cooldownScore(t.id, passedRecently, shownLast7d);
    const vibe = vibeScore(t, vibes);
    const country = countryScore(t, preferredCountries);
    const passSimilarityValue = passSimilarity(t, passedTitleProfiles);
    const passSimilarityPenalty = -PASS_SIMILARITY_PENALTY_WEIGHT * passSimilarityValue;
    const forYouBoost = forYou && taste.totalSwipes > 0 ? FOR_YOU_BOOST : 0;
    const jitter = userJitter(t.id, userSeed);
    const factors = [
      { factor: 'personalization', contribution: wPersonal * personalization },
      { factor: 'popularity', contribution: wPopularity * popularity },
      { factor: 'availability', contribution: wAvailability * availability },
      { factor: 'freshness', contribution: wFreshness * freshness },
      { factor: 'cooldown', contribution: wCooldown * cooldown },
      { factor: 'vibe', contribution: wVibes * vibe },
      { factor: 'country', contribution: wCountry * country },
      { factor: 'pass_similarity', contribution: passSimilarityPenalty },
      { factor: 'for_you', contribution: forYouBoost },
      { factor: 'stable_jitter', contribution: jitter },
    ];
    const finalScore =
      wPersonal * personalization +
      wPopularity * popularity +
      wAvailability * availability +
      wFreshness * freshness +
      wCooldown * cooldown +
      wVibes * vibe +
      wCountry * country +
      passSimilarityPenalty +
      forYouBoost +
      jitter;
    return {
      title: t,
      passSimilarity: passSimilarityValue,
      trace: {
        personalization,
        popularity,
        availability,
        freshness,
        cooldown,
        exploration: false,
        source: 'personalized' as const,
        positiveFactors: rankedFactors(factors, 'positive'),
        negativeFactors: rankedFactors(factors, 'negative'),
        finalScore,
      },
    };
  });

  // Sort by final score desc (deterministic tie-break on id), then interleave
  // the feed mix: personalized backbone + trending + fresh + exploration.
  scored.sort(
    (a, b) => b.trace.finalScore - a.trace.finalScore || (a.title.id < b.title.id ? -1 : 1),
  );
  const merged = balanceKinds(mixFeed(scored, targetSize, now), scored, targetSize);

  // Diversity guard: no more than 3 consecutive cards in the same primary genre.
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

  const finalCards = ordered.slice(0, targetSize);
  const sources: Record<DeckCardSource, number> = {
    personalized: 0,
    trending: 0,
    fresh: 0,
    exploration: 0,
  };
  for (const card of finalCards) {
    sources[card.trace.source] += 1;
  }

  return {
    cards: finalCards,
    isNarrow: ordered.length < targetSize,
    diagnostics: {
      candidateCount: candidates.length,
      eligibleCount: eligible.length,
      finalCardsCount: finalCards.length,
      excludedCount: candidates.length - eligible.length,
      exclusions,
      sources,
    },
  };
}

/** Development-only helper for inspecting a composed card without changing UI. */
export function debugRecommendation(card: DeckCard): void {
  const isDevelopment =
    typeof globalThis === 'object' &&
    '__DEV__' in globalThis &&
    (globalThis as { __DEV__?: unknown }).__DEV__ === true;
  if (!isDevelopment) return;
  // biome-ignore lint/suspicious/noConsole: explicit development-only recommendation diagnostics
  console.debug('[recommendation]', {
    itemId: card.title.id,
    title: card.title.title,
    finalScore: card.trace.finalScore,
    source: card.trace.source,
    positiveFactors: card.trace.positiveFactors,
    negativeFactors: card.trace.negativeFactors,
  });
}

export function moodToFilter(mood: MoodPreset | null) {
  if (!mood) return {};
  return MOOD_PRESETS[mood];
}
