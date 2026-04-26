import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import {
  type Title,
  type WatchlistItem,
  WatchlistItemSchema,
  type WatchlistPriority,
} from '@flixy/shared';

import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { useTitlesByIds } from '../catalogue/hooks';

/**
 * Watchlist read/write APIs (FSD section 3.7). Reads come from
 * `watchlist_items` joined client-side with `titles`. Writes are direct
 * Supabase mutations (not queued — watchlist actions happen on screens that
 * tolerate a brief network round-trip; the offline path stays in the swipe
 * queue).
 */

const RowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title_id: z.string().uuid(),
  priority: z.enum(['top', 'normal']),
  position: z.number().int(),
  added_at: z.string(),
  watched_at: z.string().nullable(),
  removed_at: z.string().nullable(),
});

function rowToItem(r: z.infer<typeof RowSchema>): WatchlistItem {
  return WatchlistItemSchema.parse({
    id: r.id,
    userId: r.user_id,
    titleId: r.title_id,
    priority: r.priority,
    position: r.position,
    addedAt: r.added_at,
    watchedAt: r.watched_at,
    removedAt: r.removed_at,
  });
}

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
      let q = supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', userId)
        .is('removed_at', null);
      if (filter === 'top') q = q.eq('priority', 'top');
      if (filter === 'watched') q = q.not('watched_at', 'is', null);
      else q = q.is('watched_at', null);
      q = q.order('priority', { ascending: false }).order('position', { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return z
        .array(RowSchema)
        .parse(data ?? [])
        .map(rowToItem);
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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('watchlist_items')
        .update({ watched_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidate(),
  });
}

export function useUnmarkWatched() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('watchlist_items')
        .update({ watched_at: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidate(),
  });
}

export function useRemoveFromWatchlist() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('watchlist_items')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidate(),
  });
}

export function useSetPriority() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: WatchlistPriority }) => {
      const { error } = await supabase.from('watchlist_items').update({ priority }).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidate(),
  });
}
