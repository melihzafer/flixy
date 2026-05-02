import { createClient } from '@supabase/supabase-js';

import { runCatalogueIngestion } from './ingest';
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

function parseContentTypes(value: string): ContentType[] {
  return parseCsv(value).map((item) => {
    if (!CONTENT_TYPES.includes(item as ContentType)) {
      throw new Error(`Invalid --kind value "${item}"`);
    }
    return item as ContentType;
  });
}

function parseTmdbIds(
  kind: ContentType,
  value: string,
): Array<{ kind: ContentType; tmdbId: number }> {
  return parseCsv(value).map((raw) => {
    const tmdbId = Number.parseInt(raw, 10);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      throw new Error(`Invalid --${kind} TMDB id "${raw}"`);
    }
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
      options.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg.startsWith('--movie=')) {
      options.explicitTitles.push(...parseTmdbIds('movie', arg.slice('--movie='.length)));
    } else if (arg.startsWith('--tv=')) {
      options.explicitTitles.push(...parseTmdbIds('tv', arg.slice('--tv='.length)));
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }

  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = env('SUPABASE_URL') ?? env('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL',
    );
  }
  const supabase = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const bearerToken = env('TMDB_BEARER_TOKEN') ?? env('TMDB_READ_ACCESS_TOKEN');
  const apiKey = env('TMDB_API_KEY');
  if (!bearerToken && !apiKey) {
    throw new Error('Missing required environment variable TMDB_BEARER_TOKEN or TMDB_API_KEY');
  }
  const tmdb = new TmdbClient(bearerToken ? { bearerToken } : { apiKey: apiKey as string });

  const result = await runCatalogueIngestion({
    supabase,
    tmdb,
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

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`catalogue ingest failed: ${message}\n`);
  process.exitCode = 1;
});
