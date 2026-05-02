import type {
  AvailabilityRefreshTarget,
  ContentType,
  IngestPlan,
  OfferType,
  PlannedAvailabilityRow,
  PlannedVideoRow,
  TitleRowPayload,
} from './types.ts';

type TmdbGenre = { id: number; name?: string };
type TmdbPerson = {
  id?: number;
  name?: string | null;
  order?: number;
  popularity?: number;
  job?: string;
  department?: string;
};
type TmdbVideo = {
  key?: string | null;
  site?: string | null;
  type?: string | null;
  official?: boolean | null;
  iso_639_1?: string | null;
  iso_3166_1?: string | null;
  published_at?: string | null;
};
type TmdbProvider = { provider_id?: number; provider_name?: string; display_priority?: number };
type TmdbWatchRegion = {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
};
type TmdbWatchProviders = { results?: Record<string, TmdbWatchRegion | undefined> };
type TmdbReleaseDates = {
  results?: Array<{
    iso_3166_1?: string;
    release_dates?: Array<{ certification?: string | null }>;
  }>;
};
type TmdbContentRatings = {
  results?: Array<{ iso_3166_1?: string; rating?: string | null }>;
};

export type TmdbMovieDetail = {
  id: number;
  title?: string | null;
  original_title?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
  popularity?: number | null;
  genres?: TmdbGenre[];
  adult?: boolean | null;
  original_language?: string | null;
  tagline?: string | null;
  credits?: { cast?: TmdbPerson[]; crew?: TmdbPerson[] };
  videos?: { results?: TmdbVideo[] };
  release_dates?: TmdbReleaseDates;
  'watch/providers'?: TmdbWatchProviders;
  external_ids?: Record<string, string | null | undefined>;
};

export type TmdbTvDetail = {
  id: number;
  name?: string | null;
  original_name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  episode_run_time?: number[] | null;
  vote_average?: number | null;
  popularity?: number | null;
  genres?: TmdbGenre[];
  adult?: boolean | null;
  original_language?: string | null;
  tagline?: string | null;
  created_by?: TmdbPerson[];
  credits?: { cast?: TmdbPerson[]; crew?: TmdbPerson[] };
  aggregate_credits?: { cast?: TmdbPerson[]; crew?: TmdbPerson[] };
  videos?: { results?: TmdbVideo[] };
  content_ratings?: TmdbContentRatings;
  'watch/providers'?: TmdbWatchProviders;
  external_ids?: Record<string, string | null | undefined>;
};

export type TmdbTitleDetail =
  | { kind: 'movie'; detail: TmdbMovieDetail }
  | { kind: 'tv'; detail: TmdbTvDetail };

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const GENRE_ID_MAP = new Map<number, string[]>([
  [28, ['action']],
  [12, ['adventure']],
  [16, ['animation']],
  [35, ['comedy']],
  [80, ['crime']],
  [99, ['documentary']],
  [18, ['drama']],
  [10751, ['family']],
  [14, ['fantasy']],
  [27, ['horror']],
  [9648, ['mystery']],
  [10749, ['romance']],
  [878, ['sci_fi']],
  [53, ['thriller']],
  [10752, ['war']],
  [37, ['western']],
  [10759, ['action', 'adventure']],
  [10762, ['family']],
  [10763, ['documentary']],
  [10764, ['drama']],
  [10765, ['sci_fi', 'fantasy']],
  [10766, ['drama']],
  [10767, ['documentary']],
  [10768, ['war']],
]);

const PROVIDER_ID_MAP = new Map<number, string>([
  [8, 'netflix'],
  [9, 'prime_video'],
  [15, 'hulu'],
  [11, 'mubi'],
  [337, 'disney_plus'],
  [350, 'apple_tv'],
  [384, 'hbo_max'],
  [531, 'paramount'],
  [386, 'peacock'],
  [341, 'blutv'],
  [149, 'movistar'],
  [381, 'canal_plus'],
  [307, 'globoplay'],
]);

const PROVIDER_NAME_PATTERNS: Array<[RegExp, string]> = [
  [/netflix/i, 'netflix'],
  [/prime video|amazon/i, 'prime_video'],
  [/disney/i, 'disney_plus'],
  [/hbo|max/i, 'hbo_max'],
  [/apple tv/i, 'apple_tv'],
  [/hulu/i, 'hulu'],
  [/paramount/i, 'paramount'],
  [/peacock/i, 'peacock'],
  [/blutv/i, 'blutv'],
  [/exxen/i, 'exxen'],
  [/mubi/i, 'mubi'],
  [/movistar/i, 'movistar'],
  [/canal/i, 'canal_plus'],
  [/globoplay/i, 'globoplay'],
];

function normalizeRegion(region: string): string {
  const normalized = region.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error(`Invalid region "${region}". Expected ISO-3166 alpha-2.`);
  }
  return normalized;
}

function compactText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function imageUrl(path: string | null | undefined, size = 'w780'): string | null {
  const cleanPath = compactText(path);
  return cleanPath ? `${IMAGE_BASE_URL}/${size}${cleanPath}` : null;
}

function releaseYear(date: string | null | undefined): number | null {
  const match = compactText(date)?.match(/^(\d{4})-/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function positiveInt(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function oneDecimal(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function mapGenres(genres: TmdbGenre[] | undefined): string[] {
  return unique(
    (genres ?? []).flatMap((genre) => GENRE_ID_MAP.get(genre.id) ?? []).filter(Boolean),
  );
}

function peopleNames(people: TmdbPerson[] | undefined, limit: number): string[] {
  return unique(
    [...(people ?? [])]
      .sort(
        (a, b) => (a.order ?? 999) - (b.order ?? 999) || (b.popularity ?? 0) - (a.popularity ?? 0),
      )
      .map((person) => compactText(person.name))
      .filter((name): name is string => name !== null),
  ).slice(0, limit);
}

function movieDirectors(detail: TmdbMovieDetail): string[] {
  return peopleNames(
    detail.credits?.crew?.filter((person) => person.job === 'Director'),
    4,
  );
}

function tvCreators(detail: TmdbTvDetail): string[] {
  return peopleNames(detail.created_by, 4);
}

function tvCast(detail: TmdbTvDetail): string[] {
  return peopleNames(detail.aggregate_credits?.cast ?? detail.credits?.cast, 12);
}

function pickMovieCertification(detail: TmdbMovieDetail, preferredRegion: string): string | null {
  const results = detail.release_dates?.results ?? [];
  const preferred = [preferredRegion, 'US'];
  for (const region of preferred) {
    const release = results.find((item) => item.iso_3166_1 === region);
    const certification = release?.release_dates
      ?.map((date) => compactText(date.certification))
      .find((value): value is string => value !== null);
    if (certification) return certification;
  }
  for (const release of results) {
    const certification = release.release_dates
      ?.map((date) => compactText(date.certification))
      .find((value): value is string => value !== null);
    if (certification) return certification;
  }
  return null;
}

function pickTvRating(detail: TmdbTvDetail, preferredRegion: string): string | null {
  const results = detail.content_ratings?.results ?? [];
  for (const region of [preferredRegion, 'US']) {
    const rating = compactText(results.find((item) => item.iso_3166_1 === region)?.rating);
    if (rating) return rating;
  }
  return (
    results
      .map((item) => compactText(item.rating))
      .find((rating): rating is string => rating !== null) ?? null
  );
}

function videoScore(video: TmdbVideo, preferredRegion: string): number {
  return (
    (video.type === 'Trailer' ? 40 : 0) +
    (video.official ? 20 : 0) +
    (video.iso_3166_1 === preferredRegion ? 10 : 0) +
    (video.iso_639_1 === 'en' ? 5 : 0)
  );
}

function sortedYoutubeVideos(
  videos: TmdbVideo[] | undefined,
  preferredRegion: string,
): TmdbVideo[] {
  return [...(videos ?? [])]
    .filter((video) => compactText(video.key) && video.site === 'YouTube')
    .sort((a, b) => videoScore(b, preferredRegion) - videoScore(a, preferredRegion));
}

function trailerKey(videos: TmdbVideo[] | undefined, preferredRegion: string): string | null {
  return compactText(sortedYoutubeVideos(videos, preferredRegion)[0]?.key);
}

function providerSlug(provider: TmdbProvider): string | null {
  if (typeof provider.provider_id === 'number') {
    const mapped = PROVIDER_ID_MAP.get(provider.provider_id);
    if (mapped) return mapped;
  }
  const name = compactText(provider.provider_name);
  if (!name) return null;
  for (const [pattern, slug] of PROVIDER_NAME_PATTERNS) {
    if (pattern.test(name)) return slug;
  }
  return null;
}

function mapAvailabilityList(input: {
  tmdbId: number;
  kind: ContentType;
  region: string;
  offerType: OfferType;
  providers?: TmdbProvider[];
  deepLink: string | null;
  observedAt: string;
}): PlannedAvailabilityRow[] {
  return unique(
    [...(input.providers ?? [])]
      .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
      .map(providerSlug)
      .filter((serviceId): serviceId is string => serviceId !== null),
  ).map((serviceId) => ({
    tmdb_id: input.tmdbId,
    content_type: input.kind,
    service_id: serviceId,
    region: input.region,
    offer_type: input.offerType,
    deep_link: input.deepLink,
    observed_at: input.observedAt,
  }));
}

function mapAvailability(input: {
  tmdbId: number;
  kind: ContentType;
  providers: TmdbWatchProviders | undefined;
  regions: string[];
  observedAt: string;
}): PlannedAvailabilityRow[] {
  const rows: PlannedAvailabilityRow[] = [];
  for (const region of input.regions) {
    const regionData = input.providers?.results?.[region];
    const deepLink = compactText(regionData?.link);
    rows.push(
      ...mapAvailabilityList({
        tmdbId: input.tmdbId,
        kind: input.kind,
        region,
        offerType: 'subscription',
        providers: regionData?.flatrate,
        deepLink,
        observedAt: input.observedAt,
      }),
      ...mapAvailabilityList({
        tmdbId: input.tmdbId,
        kind: input.kind,
        region,
        offerType: 'rent',
        providers: regionData?.rent,
        deepLink,
        observedAt: input.observedAt,
      }),
      ...mapAvailabilityList({
        tmdbId: input.tmdbId,
        kind: input.kind,
        region,
        offerType: 'buy',
        providers: regionData?.buy,
        deepLink,
        observedAt: input.observedAt,
      }),
      ...mapAvailabilityList({
        tmdbId: input.tmdbId,
        kind: input.kind,
        region,
        offerType: 'free',
        providers: [...(regionData?.free ?? []), ...(regionData?.ads ?? [])],
        deepLink,
        observedAt: input.observedAt,
      }),
    );
  }
  return rows;
}

function mapVideos(input: {
  tmdbId: number;
  kind: ContentType;
  videos: TmdbVideo[] | undefined;
  region: string;
  observedAt: string;
}): PlannedVideoRow[] {
  return sortedYoutubeVideos(input.videos, input.region)
    .slice(0, 8)
    .map((video) => ({
      tmdb_id: input.tmdbId,
      content_type: input.kind,
      provider: 'youtube' as const,
      video_key: compactText(video.key) ?? '',
      video_type: compactText(video.type) ?? 'Video',
      site: 'YouTube',
      official: video.official === true,
      language: compactText(video.iso_639_1),
      region: compactText(video.iso_3166_1),
      published_at: compactText(video.published_at),
      observed_at: input.observedAt,
    }))
    .filter((row) => row.video_key.length > 0);
}

function normalizeExternalIds(
  ids: Record<string, string | null | undefined> | undefined,
): Record<string, string | null> {
  const output: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(ids ?? {})) {
    if (typeof value === 'string' && value.trim().length > 0) output[key] = value.trim();
  }
  return output;
}

function titleKey(row: { tmdb_id: number; content_type: ContentType }): string {
  return `${row.content_type}:${row.tmdb_id}`;
}

function availabilityKey(row: PlannedAvailabilityRow): string {
  return `${titleKey(row)}:${row.region}:${row.service_id}:${row.offer_type}`;
}

function videoKey(row: PlannedVideoRow): string {
  return `${titleKey(row)}:${row.provider}:${row.video_key}`;
}

function refreshKey(row: AvailabilityRefreshTarget): string {
  return `${titleKey(row)}:${row.region}`;
}

export function mapTmdbTitleDetail(input: {
  item: TmdbTitleDetail;
  regions: string[];
  observedAt?: string;
}): IngestPlan {
  const regions = input.regions.map(normalizeRegion);
  const observedAt = input.observedAt ?? new Date().toISOString();
  const preferredRegion = regions[0] ?? 'US';
  const detail = input.item.detail;
  const common = {
    tmdb_id: detail.id,
    content_type: input.item.kind,
    synopsis: compactText(detail.overview),
    poster_url: imageUrl(detail.poster_path),
    backdrop_url: imageUrl(detail.backdrop_path),
    popularity:
      typeof detail.popularity === 'number' && Number.isFinite(detail.popularity)
        ? detail.popularity
        : 0,
    genres: mapGenres(detail.genres),
    language: compactText(detail.original_language),
    is_adult: detail.adult === true,
    tagline: compactText(detail.tagline),
    imdb_rating: null,
    critic_score: null,
    external_ids: normalizeExternalIds(detail.external_ids),
    tmdb_vote_average: oneDecimal(detail.vote_average),
    tmdb_updated_at: observedAt,
    ingested_at: observedAt,
    metadata_source: 'tmdb' as const,
  };

  const row: TitleRowPayload =
    input.item.kind === 'movie'
      ? {
          ...common,
          content_type: 'movie',
          title: compactText(input.item.detail.title) ?? `TMDB Movie ${input.item.detail.id}`,
          original_title: compactText(input.item.detail.original_title),
          trailer_key: trailerKey(input.item.detail.videos?.results, preferredRegion),
          release_year: releaseYear(input.item.detail.release_date),
          runtime_minutes: positiveInt(input.item.detail.runtime),
          content_rating: pickMovieCertification(input.item.detail, preferredRegion),
          directors: movieDirectors(input.item.detail),
          creators: [],
          cast: peopleNames(input.item.detail.credits?.cast, 12),
        }
      : {
          ...common,
          content_type: 'tv',
          title: compactText(input.item.detail.name) ?? `TMDB TV ${input.item.detail.id}`,
          original_title: compactText(input.item.detail.original_name),
          trailer_key: trailerKey(input.item.detail.videos?.results, preferredRegion),
          release_year: releaseYear(input.item.detail.first_air_date),
          runtime_minutes: positiveInt(input.item.detail.episode_run_time?.[0]),
          content_rating: pickTvRating(input.item.detail, preferredRegion),
          directors: [],
          creators: tvCreators(input.item.detail),
          cast: tvCast(input.item.detail),
        };

  const videos = mapVideos({
    tmdbId: detail.id,
    kind: input.item.kind,
    videos: detail.videos?.results,
    region: preferredRegion,
    observedAt,
  });
  const availability = mapAvailability({
    tmdbId: detail.id,
    kind: input.item.kind,
    providers: detail['watch/providers'],
    regions,
    observedAt,
  });
  const availabilityRefreshes = regions.map((region) => ({
    tmdb_id: detail.id,
    content_type: input.item.kind,
    region,
  }));

  return {
    titleRows: [row],
    videoRows: videos,
    availabilityRows: availability,
    availabilityRefreshes,
  };
}

export function mergeIngestPlans(plans: IngestPlan[]): IngestPlan {
  const titleRows = new Map<string, TitleRowPayload>();
  const videoRows = new Map<string, PlannedVideoRow>();
  const availabilityRows = new Map<string, PlannedAvailabilityRow>();
  const availabilityRefreshes = new Map<string, AvailabilityRefreshTarget>();

  for (const plan of plans) {
    for (const row of plan.titleRows) titleRows.set(titleKey(row), row);
    for (const row of plan.videoRows) videoRows.set(videoKey(row), row);
    for (const row of plan.availabilityRows) availabilityRows.set(availabilityKey(row), row);
    for (const row of plan.availabilityRefreshes) availabilityRefreshes.set(refreshKey(row), row);
  }

  return {
    titleRows: [...titleRows.values()],
    videoRows: [...videoRows.values()],
    availabilityRows: [...availabilityRows.values()],
    availabilityRefreshes: [...availabilityRefreshes.values()],
  };
}
