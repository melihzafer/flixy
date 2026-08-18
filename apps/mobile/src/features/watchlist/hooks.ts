import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Title, WatchlistItem, WatchlistPriority } from '@flixy/shared';

import { useSession } from '../auth/useSession';
import { useTitlesByIds } from '../catalogue/hooks';
import { events } from '../telemetry/events';
import { rowToItem, watchlistSchemas, watchlistStore } from './store';

/**
 * Watchlist read/write APIs (FSD section 3.7). Reads come from
 * `watchlist_items` joined client-side with `titles`. Writes are local-first
 * with a durable Supabase outbox, so watchlist actions remain recoverable when
 * the user is offline or the app is terminated during a retry.
 */

export const __schemas = watchlistSchemas;

export type WatchlistFilter = 'all' | 'top' | 'watched';

export type WatchlistEntry = { item: WatchlistItem; title: Title | undefined };

export type WatchlistCounts = {
  all: number;
  top: number;
  watched: number;
  unwatched: number;
};

export function useWatchlist(filter: WatchlistFilter = 'all') {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const itemsQuery = useQuery({
    queryKey: ['watchlist', userId],
    enabled: !!userId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!userId) return [] as WatchlistItem[];
      const data = await watchlistStore.getWatchlist(userId);

      // Sort by priority (top first), then position
      const sorted = [...data].sort((a, b) => {
        if (a.priority === 'top' && b.priority !== 'top') return -1;
        if (a.priority !== 'top' && b.priority === 'top') return 1;
        return a.position - b.position;
      });

      return sorted.map(rowToItem);
    },
  });

  const allItems = itemsQuery.data ?? [];
  const titleIds = allItems.map((i) => i.titleId);
  const titlesQuery = useTitlesByIds(titleIds);

  const titlesById = new Map<string, Title>();
  for (const t of titlesQuery.data ?? []) titlesById.set(t.id, t);

  const allEntries: WatchlistEntry[] = allItems.map((item) => ({
    item,
    title: titlesById.get(item.titleId),
  }));
  const entries = allEntries.filter(({ item }) => {
    if (filter === 'top') return item.priority === 'top';
    if (filter === 'watched') return !!item.watchedAt;
    return true;
  });

  return {
    entries,
    allEntries,
    counts: {
      all: allEntries.length,
      top: allEntries.filter(({ item }) => item.priority === 'top').length,
      watched: allEntries.filter(({ item }) => !!item.watchedAt).length,
      unwatched: allEntries.filter(({ item }) => !item.watchedAt).length,
    } satisfies WatchlistCounts,
    isLoading: itemsQuery.isLoading || (titleIds.length > 0 && titlesQuery.isLoading),
    isError: itemsQuery.isError || titlesQuery.isError,
    refetch: itemsQuery.refetch,
  };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['watchlist'] }),
      qc.invalidateQueries({ queryKey: ['taste_signal'] }),
      qc.invalidateQueries({ queryKey: ['deck_exclusions'] }),
      qc.invalidateQueries({ queryKey: ['deck_recommendations'] }),
    ]);
}

export function useMarkWatched() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, titleId }: { id: string; titleId: string }) => {
      await watchlistStore.updateWatchlistItem(id, { watched_at: new Date().toISOString() });
      events.watchlistMarkedWatched(titleId);
    },
    onSettled: () => invalidate(),
  });
}

export function useUnmarkWatched() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id }: { id: string; titleId: string }) => {
      await watchlistStore.updateWatchlistItem(id, { watched_at: null });
    },
    onSettled: () => invalidate(),
  });
}

export function useRemoveFromWatchlist() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, titleId }: { id: string; titleId: string }) => {
      await watchlistStore.updateWatchlistItem(id, { removed_at: new Date().toISOString() });
      events.watchlistRemoved(titleId);
    },
    onSettled: () => invalidate(),
  });
}

export function useSetPriority() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      titleId,
      priority,
    }: {
      id: string;
      titleId: string;
      priority: WatchlistPriority;
    }) => {
      await watchlistStore.updateWatchlistItem(id, { priority });
      events.watchlistPriorityChanged(titleId, priority === 'top' ? 1 : 0);
    },
    onSettled: () => invalidate(),
  });
}
