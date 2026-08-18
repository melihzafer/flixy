import { z } from 'zod';

import type { WatchlistItem } from '@flixy/shared';

import { type LocalWatchlistItem, localDb } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { createWatchlistQueueOperation, syncWatchlistOperation, watchlistQueue } from './queue';

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

async function enqueueAfterRemoteFailure(
  operation: ReturnType<typeof createWatchlistQueueOperation>,
) {
  try {
    await watchlistQueue.enqueue(operation);
  } catch (error) {
    // The local projection is already committed. If storage itself is
    // unavailable, keep the user-facing mutation successful and leave the
    // local copy available for the next retry/read cycle.
    logger.warn('watchlist outbox persistence failed', {
      message: (error as Error).message,
    });
  }
}

export const watchlistStore = {
  async getWatchlist(userId: string): Promise<LocalWatchlistItem[]> {
    if (!isSupabaseConfigured) return localDb.getWatchlist(userId);

    // Give durable local mutations a chance to reach the server before a
    // remote read can return an older projection of the same watchlist.
    await watchlistQueue.hydrate();
    await watchlistQueue.flush();

    try {
      const { data, error } = await supabase
        .from('watchlist_items')
        .select(WATCHLIST_SELECT)
        .eq('user_id', userId)
        .is('removed_at', null);
      throwIfSupabaseError(error);
      return z.array(RowSchema).parse(data ?? []);
    } catch {
      // localDb is the authoritative read source while the network is down;
      // it includes mutations that may still be waiting in the outbox.
      return localDb.getWatchlist(userId);
    }
  },

  async upsertWatchlistItem(item: Omit<LocalWatchlistItem, 'id'>): Promise<LocalWatchlistItem> {
    const local = await localDb.upsertWatchlistItem(item);
    if (!isSupabaseConfigured) return local;

    const operation = createWatchlistQueueOperation({ type: 'upsert', item });
    await watchlistQueue.flush();
    try {
      const data = await syncWatchlistOperation(operation);
      return RowSchema.parse(data);
    } catch {
      await enqueueAfterRemoteFailure(operation);
      return local;
    }
  },

  async updateWatchlistItem(id: string, updates: Partial<LocalWatchlistItem>): Promise<void> {
    await localDb.updateWatchlistItem(id, updates);
    if (!isSupabaseConfigured) return;

    const operation = createWatchlistQueueOperation({ type: 'update', itemId: id, updates });
    await watchlistQueue.flush();
    try {
      await syncWatchlistOperation(operation);
    } catch {
      await enqueueAfterRemoteFailure(operation);
    }
  },

  async updateWatchlistItemByTitle(
    userId: string,
    titleId: string,
    updates: Partial<LocalWatchlistItem>,
  ): Promise<void> {
    await localDb.updateWatchlistItemByTitle(userId, titleId, updates);
    if (!isSupabaseConfigured) return;

    const operation = createWatchlistQueueOperation({
      type: 'updateByTitle',
      userId,
      titleId,
      updates,
    });
    await watchlistQueue.flush();
    try {
      await syncWatchlistOperation(operation);
    } catch {
      await enqueueAfterRemoteFailure(operation);
    }
  },
};

export const watchlistSchemas = { LocalWatchlistItemSchema, RowSchema };
