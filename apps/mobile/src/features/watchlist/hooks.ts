import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Title, WatchlistItem, WatchlistPriority } from '@flixy/shared';

import { useSession } from '../auth/useSession';
import { useTitlesByIds } from '../catalogue/hooks';
import { events } from '../telemetry/events';
import { rowToItem, watchlistSchemas, watchlistStore } from './store';

/**
 * Watchlist read/write APIs (FSD section 3.7). Reads come from
 * `watchlist_items` joined client-side with `titles`. Writes are direct
 * Supabase mutations (not queued — watchlist actions happen on screens that
 * tolerate a brief network round-trip; the offline path stays in the swipe
 * queue).
 */

export const __schemas = watchlistSchemas;

export type WatchlistFilter = 'all' | 'top' | 'watched';

export type WatchlistEntry = { item: WatchlistItem; title: Title | undefined };

export function useWatchlist(filter: WatchlistFilter = 'all') {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const itemsQuery = useQuery({
    queryKey: ['watchlist', userId, filter],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [] as WatchlistItem[];
      const data = await watchlistStore.getWatchlist(userId);

      let filtered = data;
      if (filter === 'top') {
        filtered = filtered.filter((i) => i.priority === 'top');
      } else if (filter === 'watched') {
        filtered = filtered.filter((i) => i.watched_at !== null);
      }

      // Sort by priority (top first), then position
      const sorted = [...filtered].sort((a, b) => {
        if (a.priority === 'top' && b.priority !== 'top') return -1;
        if (a.priority !== 'top' && b.priority === 'top') return 1;
        return a.position - b.position;
      });

      return sorted.map(rowToItem);
    },
  });

  const titleIds = (itemsQuery.data ?? []).map((i) => i.titleId);
  const titlesQuery = useTitlesByIds(titleIds);

  const titlesById = new Map<string, Title>();
  for (const t of titlesQuery.data ?? []) titlesById.set(t.id, t);

  const entries: WatchlistEntry[] = (itemsQuery.data ?? []).map((item) => ({
    item,
    title: titlesById.get(item.titleId),
  }));

  return {
    entries,
    isLoading: itemsQuery.isLoading || titlesQuery.isLoading,
    isError: itemsQuery.isError || titlesQuery.isError,
    refetch: itemsQuery.refetch,
  };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['watchlist'] });
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
