import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

import { processCatalogueBackfillStep, startCatalogueBackfillJob } from './backfill';
import { runCatalogueIngestion } from './ingest';
import { exportCatalogueToR2 } from './r2Export';
import { TmdbClient } from './tmdbClient';
import { CONTENT_TYPES, type ContentType } from './types';

type CliOptions = {
  dryRun: boolean;
  regions?: string[];
  kinds?: ContentType[];
  limit?: number;
  explicitTitles: Array<{ kind: ContentType; tmdbId: number }>;
  useCache: boolean;
};

type BackfillCliOptions = {
  dryRun: boolean;
  startOnly: boolean;
  kind: ContentType;
  regions?: string[];
  batchSize?: number;
  jobId?: string;
  snapshotDate?: string;
  maxCandidates?: number;
  maxSeconds?: number;
  useCache: boolean;
};

type R2ExportCliOptions = {
  prefix?: string;
  batchSize?: number;
  limit?: number;
  offset?: number;
  concurrency?: number;
  includeAdult: boolean;
  includeHidden: boolean;
  gzip: boolean;
  objectsOnly: boolean;
  indexOnly: boolean;
};

function loadEnvFiles() {
  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'apps/mobile/.env.local'),
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '.env'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) loadDotenv({ path, override: false });
  }
}

loadEnvFiles();

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(name: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseContentType(name: string, value: string): ContentType {
  if (!CONTENT_TYPES.includes(value as ContentType)) {
    throw new Error(`Invalid ${name} value "${value}"`);
  }
  return value as ContentType;
}

function parseContentTypes(value: string): ContentType[] {
  return parseCsv(value).map((item) => parseContentType('--kind', item));
}

function parseTmdbIds(
  kind: ContentType,
  value: string,
): Array<{ kind: ContentType; tmdbId: number }> {
  return parseCsv(value).map((raw) => {
    const tmdbId = parsePositiveInteger(`--${kind}`, raw);
    return { kind, tmdbId };
  });
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: env('CATALOGUE_INGEST_DRY_RUN') === '1',
    explicitTitles: [],
    useCache: true,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--write') options.dryRun = false;
    else if (arg === '--no-cache') options.useCache = false;
    else if (arg.startsWith('--region=')) options.regions = parseCsv(arg.slice('--region='.length));
    else if (arg.startsWith('--kind='))
      options.kinds = parseContentTypes(arg.slice('--kind='.length));
    else if (arg.startsWith('--limit='))
      options.limit = parsePositiveInteger('--limit', arg.slice('--limit='.length));
    else if (arg.startsWith('--movie=')) {
      options.explicitTitles.push(...parseTmdbIds('movie', arg.slice('--movie='.length)));
    } else if (arg.startsWith('--tv=')) {
      options.explicitTitles.push(...parseTmdbIds('tv', arg.slice('--tv='.length)));
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }

  return options;
}

function parseBackfillArgs(argv: string[]): BackfillCliOptions {
  const options: BackfillCliOptions = {
    dryRun: env('CATALOGUE_INGEST_DRY_RUN') === '1',
    startOnly: false,
    kind: 'movie',
    useCache: true,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--write') options.dryRun = false;
    else if (arg === '--start') options.startOnly = true;
    else if (arg === '--no-cache') options.useCache = false;
    else if (arg.startsWith('--kind='))
      options.kind = parseContentType('--kind', arg.slice('--kind='.length));
    else if (arg.startsWith('--region=')) options.regions = parseCsv(arg.slice('--region='.length));
    else if (arg.startsWith('--batch-size='))
      options.batchSize = parsePositiveInteger('--batch-size', arg.slice('--batch-size='.length));
    else if (arg.startsWith('--limit='))
      options.batchSize = parsePositiveInteger('--limit', arg.slice('--limit='.length));
    else if (arg.startsWith('--job-id=')) options.jobId = arg.slice('--job-id='.length);
    else if (arg.startsWith('--snapshot-date='))
      options.snapshotDate = arg.slice('--snapshot-date='.length);
    else if (arg.startsWith('--max-candidates='))
      options.maxCandidates = parsePositiveInteger(
        '--max-candidates',
        arg.slice('--max-candidates='.length),
      );
    else if (arg.startsWith('--max-seconds='))
      options.maxSeconds = parsePositiveInteger(
        '--max-seconds',
        arg.slice('--max-seconds='.length),
      );
    else {
      throw new Error(`Unknown backfill argument "${arg}"`);
    }
  }

  return options;
}

function parseR2ExportArgs(argv: string[]): R2ExportCliOptions {
  const options: R2ExportCliOptions = {
    includeAdult: false,
    includeHidden: false,
    gzip: true,
    objectsOnly: false,
    indexOnly: false,
  };

  for (const arg of argv) {
    if (arg === '--include-adult') options.includeAdult = true;
    else if (arg === '--include-hidden') options.includeHidden = true;
    else if (arg === '--no-gzip') options.gzip = false;
    else if (arg === '--objects-only') options.objectsOnly = true;
    else if (arg === '--index-only') options.indexOnly = true;
    else if (arg.startsWith('--prefix=')) options.prefix = arg.slice('--prefix='.length);
    else if (arg.startsWith('--batch-size='))
      options.batchSize = parsePositiveInteger('--batch-size', arg.slice('--batch-size='.length));
    else if (arg.startsWith('--offset='))
      options.offset = parsePositiveInteger('--offset', arg.slice('--offset='.length));
    else if (arg.startsWith('--concurrency='))
      options.concurrency = parsePositiveInteger(
        '--concurrency',
        arg.slice('--concurrency='.length),
      );
    else if (arg.startsWith('--limit='))
      options.limit = parsePositiveInteger('--limit', arg.slice('--limit='.length));
    else {
      throw new Error(`Unknown r2-export argument "${arg}"`);
    }
  }

  return options;
}

function createSupabaseClient() {
  const supabaseUrl = env('SUPABASE_URL') ?? env('EXPO_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY');
  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL',
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Missing required environment variable SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY',
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function createTmdbClient() {
  const bearerToken = env('TMDB_BEARER_TOKEN') ?? env('TMDB_READ_ACCESS_TOKEN');
  const apiKey = env('TMDB_API_KEY');
  if (!bearerToken && !apiKey) {
    throw new Error('Missing required environment variable TMDB_BEARER_TOKEN or TMDB_API_KEY');
  }
  return new TmdbClient(bearerToken ? { bearerToken } : { apiKey: apiKey as string });
}

function createR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: requireEnv('R2_ENDPOINT'),
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

async function runIngest(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const result = await runCatalogueIngestion({
    supabase: createSupabaseClient(),
    tmdb: createTmdbClient(),
    regions: args.regions ?? parseCsv(env('CATALOGUE_INGEST_REGIONS') ?? 'US,TR,BG,ES,DE,FR,BR'),
    kinds: args.kinds,
    language: env('CATALOGUE_INGEST_LANGUAGE') ?? 'en-US',
    limitPerRegionKind: args.limit ?? Number.parseInt(env('CATALOGUE_INGEST_LIMIT') ?? '40', 10),
    cacheTtlHours: Number.parseInt(env('TMDB_CACHE_TTL_HOURS') ?? '24', 10),
    explicitTitles: args.explicitTitles,
    dryRun: args.dryRun,
    useCache: args.useCache,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function runBackfill(argv: string[]): Promise<void> {
  const args = parseBackfillArgs(argv);
  const supabase = createSupabaseClient();
  const tmdb = createTmdbClient();
  const regions =
    args.regions ?? parseCsv(env('CATALOGUE_INGEST_REGIONS') ?? 'US,TR,BG,ES,DE,FR,BR');

  if (args.startOnly) {
    const job = await startCatalogueBackfillJob({
      supabase,
      tmdb,
      kind: args.kind,
      regions,
      language: env('CATALOGUE_INGEST_LANGUAGE') ?? 'en-US',
      snapshotDate: args.snapshotDate,
      batchSize: args.batchSize,
      includeAdult: true,
      includeUnreleased: true,
      maxCandidates: args.maxCandidates,
    });
    process.stdout.write(`${JSON.stringify(job, null, 2)}\n`);
    return;
  }

  const result = await processCatalogueBackfillStep({
    supabase,
    tmdb,
    jobId: args.jobId,
    kind: args.jobId ? undefined : args.kind,
    regions,
    language: env('CATALOGUE_INGEST_LANGUAGE') ?? 'en-US',
    snapshotDate: args.snapshotDate,
    batchSize: args.batchSize,
    dryRun: args.dryRun,
    includeAdult: true,
    includeUnreleased: true,
    maxCandidates: args.maxCandidates,
    maxSeconds: args.maxSeconds,
    autoStart: true,
    useCache: args.useCache,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function runR2Export(argv: string[]): Promise<void> {
  const args = parseR2ExportArgs(argv);
  const result = await exportCatalogueToR2({
    supabase: createSupabaseClient(),
    s3: createR2Client(),
    bucket: env('R2_BUCKET_NAME') ?? env('R2_BUCKET') ?? 'flixy',
    prefix: args.prefix ?? env('R2_CATALOGUE_PREFIX') ?? 'catalogue',
    batchSize: args.batchSize,
    limit: args.limit,
    startOffset: args.offset,
    includeAdult: args.includeAdult,
    includeHidden: args.includeHidden,
    gzip: args.gzip,
    uploadConcurrency: args.concurrency,
    objectsOnly: args.objectsOnly,
    indexOnly: args.indexOnly,
    onProgress: (progress) => {
      const verb = args.indexOnly ? 'indexed' : 'uploaded';
      const total = (args.offset ?? 0) + progress.titleCount;
      process.stderr.write(`r2-export ${verb} ${total} titles (+${progress.batchCount})\n`);
    },
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'backfill') {
    await runBackfill(rest);
    return;
  }
  if (command === 'r2-export') {
    await runR2Export(rest);
    return;
  }
  await runIngest(command ? [command, ...rest] : []);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`catalogue ingest failed: ${message}\n`);
  process.exitCode = 1;
});
