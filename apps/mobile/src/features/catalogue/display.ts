import type { Title } from '@flixy/shared';

import { getTitleGradient } from '../../lib/gradients';

export type TitleDisplay = {
  id: string;
  title: string;
  year: number | null;
  runtime: string | null;
  rating: string | null;
  genres: string[];
  synopsis: string | null;
  hook: string | null;
  services: string[];
  score: number | null;
  rt: number | null;
  director: string | null;
  creators: string[];
  cast: string[];
  gradient: readonly [string, string, string, string];
  kind: 'movie' | 'tv';
  posterUrl: string | null;
  backdropUrl: string | null;
};

function firstSentence(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?[.!?])(\s|$)/);
  return match?.[1] ?? trimmed;
}

export function toTitleDisplay(t: Title): TitleDisplay {
  const runtime = (() => {
    const mins = t.runtimeMinutes;
    if (!mins || mins <= 0) return null;
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  })();

  const services = Array.from(new Set(t.availability.map((a) => a.serviceId))).slice(0, 4);

  // Map service IDs to readable names for badges
  const serviceNames = services.map((s) => {
    const map: Record<string, string> = {
      netflix: 'Netflix',
      prime_video: 'Prime Video',
      hbo_max: 'Max',
      disney_plus: 'Disney+',
      hulu: 'Hulu',
      apple_tv: 'Apple TV+',
      mubi: 'MUBI',
      paramount_plus: 'Paramount+',
    };
    return map[s] ?? s;
  });

  return {
    id: t.id,
    title: t.title,
    year: t.releaseYear,
    runtime,
    rating: t.contentRating ?? null,
    genres: t.genres.map((g) => g.charAt(0).toUpperCase() + g.slice(1)),
    synopsis: t.overview,
    hook: t.tagline ?? firstSentence(t.overview),
    services: serviceNames,
    score: t.imdbRating,
    rt: t.criticScore ?? null,
    director: t.directors?.[0] ?? null,
    creators: t.creators ?? [],
    cast: t.cast ?? [],
    gradient: getTitleGradient(t.id),
    kind: t.kind,
    posterUrl: t.posterUrl,
    backdropUrl: t.backdropUrl,
  };
}
