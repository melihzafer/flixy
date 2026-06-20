export const CONTENT_TYPES = ['movie', 'tv'] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type OfferType = 'subscription' | 'rent' | 'buy' | 'free';

export type CandidateSource =
  | 'explicit'
  | 'popular'
  | 'trending_day'
  | 'now_playing'
  | 'on_the_air'
  | 'tmdb_export'
  | 'tmdb_changes';

export type CandidateRef = {
  kind: ContentType;
  tmdbId: number;
  region: string;
  source: CandidateSource;
  popularity?: number;
  adult?: boolean;
};

export type ExternalIds = Record<string, string | null>;

export type TitleRowPayload = {
  tmdb_id: number;
  content_type: ContentType;
  title: string;
  original_title: string | null;
  synopsis: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_key: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  content_rating: string | null;
  imdb_rating: number | null;
  critic_score: number | null;
  popularity: number;
  genres: string[];
  language: string | null;
  is_adult: boolean;
  tagline: string | null;
  directors: string[];
  creators: string[];
  cast: string[];
  external_ids: ExternalIds;
  tmdb_vote_average: number | null;
  tmdb_updated_at: string;
  ingested_at: string;
  metadata_source: 'tmdb';
};

export type PlannedVideoRow = {
  tmdb_id: number;
  content_type: ContentType;
  provider: 'youtube';
  video_key: string;
  video_type: string;
  site: string;
  official: boolean;
  language: string | null;
  region: string | null;
  published_at: string | null;
  observed_at: string;
};

export type PlannedAvailabilityRow = {
  tmdb_id: number;
  content_type: ContentType;
  service_id: string;
  region: string;
  offer_type: OfferType;
  deep_link: string | null;
  observed_at: string;
};

export type AvailabilityRefreshTarget = {
  tmdb_id: number;
  content_type: ContentType;
  region: string;
};

export type IngestPlan = {
  titleRows: TitleRowPayload[];
  videoRows: PlannedVideoRow[];
  availabilityRows: PlannedAvailabilityRow[];
  availabilityRefreshes: AvailabilityRefreshTarget[];
};

export type IngestWriteSummary = {
  dryRun: boolean;
  candidateCount: number;
  titleCount: number;
  videoCount: number;
  availabilityCount: number;
  availabilityRefreshCount: number;
  titleIds: Record<string, string>;
};

export type BackfillJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type BackfillJobSource = 'tmdb_export' | 'tmdb_changes';

export type CatalogueBackfillJob = {
  id: string;
  kind: ContentType;
  source: BackfillJobSource;
  snapshot_date: string;
  status: BackfillJobStatus;
  regions: string[];
  language: string;
  include_adult: boolean;
  include_unreleased: boolean;
  batch_size: number;
  total_candidates: number;
  processed_count: number;
  title_count: number;
  video_count: number;
  availability_count: number;
  error_count: number;
  skipped_count: number;
  last_error: string | null;
};

export type CatalogueBackfillCursor = {
  job_id: string;
  next_offset: number;
  batch_size: number;
  last_processed_tmdb_id: number | null;
  consecutive_failures: number;
};

export type CatalogueBackfillStepResult = {
  jobId: string;
  kind: ContentType;
  dryRun: boolean;
  status: BackfillJobStatus;
  offsetStart: number;
  offsetEnd: number;
  totalCandidates: number;
  processedCount: number;
  succeededIds: number[];
  failedIds: number[];
  titleCount: number;
  videoCount: number;
  availabilityCount: number;
  nextOffset: number;
  completed: boolean;
};
