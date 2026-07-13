import type { Title } from '@flixy/shared';

/**
 * A fully resolved deck policy. Every candidate source passes through this
 * policy after API fetching, so remote recommendations and fallback data can
 * never bypass a setting the user explicitly chose.
 */
export type DeckFilterPolicy = {
  kinds: Array<'movie' | 'tv'>;
  serviceIds: string[];
  /** Selected genres constrain the title's primary genre. */
  includeGenres: string[];
  /** Blocked genres reject a title even when they are secondary. */
  excludeGenres: string[];
  includeLanguages: string[];
  excludeLanguages: string[];
  minYear: number | null;
  maxYear: number | null;
  minRuntime: number | null;
  maxRuntime: number | null;
  originCountryLanguage: string | null;
};

export type DeckPreferenceDefaults = {
  selectedGenres: string[];
  excludedGenres: string[];
  preferredLanguages: string[];
  excludedLanguages: string[];
  selectedServices: string[];
};

export type DeckSessionFilters = {
  kinds: Array<'movie' | 'tv'>;
  serviceIds: string[] | null;
  genres: string[] | null;
  excludedGenres: string[] | null;
  languages: string[] | null;
  excludedLanguages: string[] | null;
  minYear: number | null;
  maxYear: number | null;
  minRuntime: number | null;
  maxRuntime: number | null;
  originCountryLanguage: string | null;
};

function unique(values: readonly string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
    ),
  );
}

/** Session include filters replace the saved default; blocks are always additive. */
export function resolveDeckFilterPolicy(
  defaults: DeckPreferenceDefaults,
  session: DeckSessionFilters,
): DeckFilterPolicy {
  return {
    kinds: session.kinds,
    serviceIds: unique(session.serviceIds ?? defaults.selectedServices),
    includeGenres: unique(session.genres ?? defaults.selectedGenres),
    excludeGenres: unique([...(defaults.excludedGenres ?? []), ...(session.excludedGenres ?? [])]),
    includeLanguages: unique(session.languages ?? defaults.preferredLanguages),
    excludeLanguages: unique([
      ...(defaults.excludedLanguages ?? []),
      ...(session.excludedLanguages ?? []),
    ]),
    minYear: session.minYear,
    maxYear: session.maxYear,
    minRuntime: session.minRuntime,
    maxRuntime: session.maxRuntime,
    originCountryLanguage: session.originCountryLanguage?.toLowerCase() ?? null,
  };
}

/**
 * Strict, final client-side policy enforcement. API queries narrow the pool,
 * but title metadata is the authority because TMDB genre queries are OR based
 * and recommendation/fallback candidates are merged after the request.
 */
export function titleMatchesDeckPolicy(title: Title, policy: DeckFilterPolicy): boolean {
  if (policy.kinds.length > 0 && !policy.kinds.includes(title.kind)) return false;

  const genres = unique(title.genres);
  const primaryGenre = genres[0] ?? null;
  if (policy.includeGenres.length > 0 && !primaryGenre) return false;
  if (
    primaryGenre &&
    policy.includeGenres.length > 0 &&
    !policy.includeGenres.includes(primaryGenre)
  ) {
    return false;
  }
  if (genres.some((genre) => policy.excludeGenres.includes(genre))) return false;

  const language = title.language?.toLowerCase() ?? null;
  if (
    policy.includeLanguages.length > 0 &&
    (!language || !policy.includeLanguages.includes(language))
  ) {
    return false;
  }
  if (language && policy.excludeLanguages.includes(language)) return false;
  if (policy.originCountryLanguage && language !== policy.originCountryLanguage) return false;

  if (policy.minYear != null && (title.releaseYear == null || title.releaseYear < policy.minYear)) {
    return false;
  }
  if (policy.maxYear != null && (title.releaseYear == null || title.releaseYear > policy.maxYear)) {
    return false;
  }
  if (
    policy.minRuntime != null &&
    (title.runtimeMinutes == null || title.runtimeMinutes < policy.minRuntime)
  ) {
    return false;
  }
  if (
    policy.maxRuntime != null &&
    (title.runtimeMinutes == null || title.runtimeMinutes > policy.maxRuntime)
  ) {
    return false;
  }
  if (
    policy.serviceIds.length > 0 &&
    !title.availability.some((availability) => policy.serviceIds.includes(availability.serviceId))
  ) {
    return false;
  }
  return true;
}
