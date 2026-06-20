import { z } from 'zod';

import type { WatchlistItem } from '@flixy/shared';

import { type LocalWatchlistItem, localDb } from '../../lib/localDb';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const WATCHLIST_SELECT = 'id,user_id,title_id,priority,position,added_at,watched_at,removed_at';

const LocalIdSchema = z.string().min(1);

export const RowSchema = z.object({
  id: LocalIdSchema,
  user_id: LocalIdSchema,
  title_id: LocalIdSchema,
  priority: z.enum(['top', 'normal']),
  position: z.number().int(),
  added_at: z.string(),
  watched_at: z.string().nullable(),
  removed_at: z.string().nullable(),
});

const LocalWatchlistItemSchema = z.object({
  id: LocalIdSchema,
  userId: LocalIdSchema,
  titleId: LocalIdSchema,
  priority: z.enum(['top', 'normal']),
  position: z.number().int(),
  addedAt: z.string(),
  watchedAt: z.string().nullable().optional(),
  removedAt: z.string().nullable().optional(),
});

export function rowToItem(r: z.infer<typeof RowSchema>): WatchlistItem {
  return LocalWatchlistItemSchema.parse({
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

function throwIfSupabaseError(error: unknown): asserts error is null {
  if (!error) return;
  if (error instanceof Error) throw error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') throw new Error(message);
  }
  throw new Error(String(error));
}

export const watchlistStore = {
  async getWatchlist(userId: string): Promise<LocalWatchlistItem[]> {
    if (!isSupabaseConfigured) return localDb.getWatchlist(userId);

    const { data, error } = await supabase
      .from('watchlist_items')
      .select(WATCHLIST_SELECT)
      .eq('user_id', userId)
      .is('removed_at', null);
    throwIfSupabaseError(error);
    return z.array(RowSchema).parse(data ?? []);
  },

  async upsertWatchlistItem(item: Omit<LocalWatchlistItem, 'id'>): Promise<LocalWatchlistItem> {
    if (!isSupabaseConfigured) return localDb.upsertWatchlistItem(item);

    const { data, error } = await supabase
      .from('watchlist_items')
      .upsert(item, { onConflict: 'user_id,title_id' })
      .select(WATCHLIST_SELECT)
      .single();
    throwIfSupabaseError(error);
    return RowSchema.parse(data);
  },

  async updateWatchlistItem(id: string, updates: Partial<LocalWatchlistItem>): Promise<void> {
    if (!isSupabaseConfigured) {
      await localDb.updateWatchlistItem(id, updates);
      return;
    }

    const { error } = await supabase.from('watchlist_items').update(updates).eq('id', id);
    throwIfSupabaseError(error);
  },

  async updateWatchlistItemByTitle(
    userId: string,
    titleId: string,
    updates: Partial<LocalWatchlistItem>,
  ): Promise<void> {
    if (!isSupabaseConfigured) {
      await localDb.updateWatchlistItemByTitle(userId, titleId, updates);
      return;
    }

    const { error } = await supabase
      .from('watchlist_items')
      .update(updates)
      .eq('user_id', userId)
      .eq('title_id', titleId);
    throwIfSupabaseError(error);
  },
};

export const watchlistSchemas = { LocalWatchlistItemSchema, RowSchema };
