import type { Title, WatchlistItem } from '@flixy/shared';

export type WatchlistKindFilter = 'all' | 'movie' | 'tv';
export type WatchlistRuntimeFilter = 'any' | 'short' | 'standard' | 'epic';
export type WatchlistPickBudget = 3 | 5 | 7;

export type WatchlistPlannerFilter = {
  kind: WatchlistKindFilter;
  runtime: WatchlistRuntimeFilter;
  serviceId?: string | null;
  excludeWatched?: boolean;
};

export type WatchlistPlannerCandidate = {
  item: WatchlistItem;
  title: Title;
};

export type GroupVoteDirection = 'left' | 'right';

export type GroupVote = {
  participantId: string;
  titleId: string;
  direction: GroupVoteDirection;
};

export type GroupResultLabel = 'match' | 'contender' | 'one_person_pick';

export type GroupResult = WatchlistPlannerCandidate & {
  voteCount: number;
  participantIds: string[];
  label: GroupResultLabel;
};

export const WATCHLIST_PICK_BUDGETS = [3, 5, 7] as const;

export function normalizePickBudget(value: number): WatchlistPickBudget {
  if (value >= 7) return 7;
  if (value >= 5) return 5;
  return 3;
}

function matchesRuntime(title: Title, runtime: WatchlistRuntimeFilter): boolean {
  if (runtime === 'any') return true;
  if (title.runtimeMinutes == null) return false;
  if (runtime === 'short') return title.runtimeMinutes <= 100;
  if (runtime === 'standard') return title.runtimeMinutes > 100 && title.runtimeMinutes <= 140;
  return title.runtimeMinutes > 140;
}

export function filterWatchlistCandidates(
  candidates: readonly WatchlistPlannerCandidate[],
  filter: WatchlistPlannerFilter,
): WatchlistPlannerCandidate[] {
  return candidates.filter(({ item, title }) => {
    if (item.removedAt) return false;
    if (filter.excludeWatched !== false && item.watchedAt) return false;
    if (filter.kind !== 'all' && title.kind !== filter.kind) return false;
    if (!matchesRuntime(title, filter.runtime)) return false;
    if (
      filter.serviceId &&
      !title.availability.some((entry) => entry.serviceId === filter.serviceId)
    ) {
      return false;
    }
    return true;
  });
}

function candidateScore({ item, title }: WatchlistPlannerCandidate): number {
  const priorityBoost = item.priority === 'top' ? 100_000 : 0;
  const ratingBoost = (title.imdbRating ?? 0) * 1_000;
  const popularityBoost = Math.min(500, Math.max(0, title.popularity));
  const positionBoost = Math.max(0, 500 - item.position);
  return priorityBoost + ratingBoost + popularityBoost + positionBoost;
}

/**
 * Ranks a small, explainable shortlist. The order is deterministic so the
 * same watchlist and context do not reshuffle while the user is deciding.
 */
export function rankTonightCandidates(
  candidates: readonly WatchlistPlannerCandidate[],
  filter: WatchlistPlannerFilter,
  limit = 3,
): WatchlistPlannerCandidate[] {
  return filterWatchlistCandidates(candidates, filter)
    .slice()
    .sort((a, b) => candidateScore(b) - candidateScore(a) || a.title.id.localeCompare(b.title.id))
    .slice(0, Math.max(0, limit));
}

function resultLabel(voteCount: number, participantCount: number): GroupResultLabel {
  if (voteCount >= participantCount) return 'match';
  if (voteCount > 1) return 'contender';
  return 'one_person_pick';
}

/**
 * Aggregates pass-and-play votes without persisting them. A participant can
 * contribute at most `pickBudget` unique right-swipes; later right-swipes are
 * ignored, which keeps the result fair even if a UI retries a gesture.
 */
export function aggregateGroupVotes(
  candidates: readonly WatchlistPlannerCandidate[],
  votes: readonly GroupVote[],
  participantCount: number,
  pickBudget: WatchlistPickBudget,
): GroupResult[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.title.id, candidate]));
  const participantIds = Array.from(new Set(votes.map((vote) => vote.participantId))).slice(
    0,
    Math.max(0, participantCount),
  );
  const allowedParticipants = new Set(participantIds);
  const picksByParticipant = new Map<string, Set<string>>();

  for (const vote of votes) {
    if (vote.direction !== 'right' || !allowedParticipants.has(vote.participantId)) continue;
    if (!candidateById.has(vote.titleId)) continue;
    const picks = picksByParticipant.get(vote.participantId) ?? new Set<string>();
    if (picks.size < pickBudget) picks.add(vote.titleId);
    picksByParticipant.set(vote.participantId, picks);
  }

  const resultByTitle = new Map<string, Set<string>>();
  for (const [participantId, picks] of picksByParticipant) {
    for (const titleId of picks) {
      const voters = resultByTitle.get(titleId) ?? new Set<string>();
      voters.add(participantId);
      resultByTitle.set(titleId, voters);
    }
  }

  return Array.from(resultByTitle.entries())
    .map(([titleId, voters]) => {
      const candidate = candidateById.get(titleId);
      if (!candidate) return null;
      return {
        ...candidate,
        voteCount: voters.size,
        participantIds: Array.from(voters),
        label: resultLabel(voters.size, participantCount),
      } satisfies GroupResult;
    })
    .filter((result): result is GroupResult => result !== null)
    .sort(
      (a, b) =>
        b.voteCount - a.voteCount ||
        Number(b.item.priority === 'top') - Number(a.item.priority === 'top') ||
        (b.title.imdbRating ?? 0) - (a.title.imdbRating ?? 0) ||
        b.title.popularity - a.title.popularity ||
        a.title.id.localeCompare(b.title.id),
    );
}
