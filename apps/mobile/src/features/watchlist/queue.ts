import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { create } from 'zustand';

import type { LocalWatchlistItem } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

/**
 * Watchlist mutations are local-first. A failed remote mutation is retained
 * here so a restart or reconnect cannot silently lose the user's change.
 * Operations are applied in insertion order and each operation is safe to
 * replay: upsert uses the server's user/title conflict key and updates are
 * field assignments.
 */

export const WATCHLIST_QUEUE_STORAGE_KEY = 'flixy.watchlist_queue.v1';
const WATCHLIST_SELECT = 'id,user_id,title_id,priority,position,added_at,watched_at,removed_at';
const MAX_BACKOFF_MS = 30_000;

const LocalIdSchema = z.string().min(1);

const WatchlistInputSchema = z.object({
  user_id: LocalIdSchema,
  title_id: LocalIdSchema,
  priority: z.enum(['top', 'normal']),
  position: z.number().int(),
  added_at: z.string(),
  watched_at: z.string().nullable(),
  removed_at: z.string().nullable(),
});

const WatchlistUpdatesSchema = z
  .object({
    id: LocalIdSchema,
    user_id: LocalIdSchema,
    title_id: LocalIdSchema,
    priority: z.enum(['top', 'normal']),
    position: z.number().int(),
    added_at: z.string(),
    watched_at: z.string().nullable(),
    removed_at: z.string().nullable(),
  })
  .partial();

const QueueOperationSchema = z.discriminatedUnion('type', [
  z.object({
    operationId: LocalIdSchema,
    type: z.literal('upsert'),
    item: WatchlistInputSchema,
  }),
  z.object({
    operationId: LocalIdSchema,
    type: z.literal('update'),
    itemId: LocalIdSchema,
    updates: WatchlistUpdatesSchema,
  }),
  z.object({
    operationId: LocalIdSchema,
    type: z.literal('updateByTitle'),
    userId: LocalIdSchema,
    titleId: LocalIdSchema,
    updates: WatchlistUpdatesSchema,
  }),
]);

export type WatchlistQueueOperation =
  | {
      operationId: string;
      type: 'upsert';
      item: Omit<LocalWatchlistItem, 'id'>;
    }
  | {
      operationId: string;
      type: 'update';
      itemId: string;
      updates: Partial<LocalWatchlistItem>;
    }
  | {
      operationId: string;
      type: 'updateByTitle';
      userId: string;
      titleId: string;
      updates: Partial<LocalWatchlistItem>;
    };

export type WatchlistQueueOperationInput =
  | (Omit<Extract<WatchlistQueueOperation, { type: 'upsert' }>, 'operationId'> & {
      operationId?: string;
    })
  | (Omit<Extract<WatchlistQueueOperation, { type: 'update' }>, 'operationId'> & {
      operationId?: string;
    })
  | (Omit<Extract<WatchlistQueueOperation, { type: 'updateByTitle' }>, 'operationId'> & {
      operationId?: string;
    });

export const WatchlistQueueOperationSchema = QueueOperationSchema;

let generatedOperationCount = 0;
let storageWriteTail: Promise<void> = Promise.resolve();

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

function newOperationId(): string {
  // The suffix also keeps tests and unusual native implementations safe when
  // randomUUID is mocked or temporarily returns the same value.
  const id = Crypto.randomUUID();
  generatedOperationCount += 1;
  return `${id}-${generatedOperationCount}`;
}

export function createWatchlistQueueOperation(
  input: WatchlistQueueOperationInput,
): WatchlistQueueOperation {
  return QueueOperationSchema.parse({
    ...input,
    operationId: input.operationId ?? newOperationId(),
  }) as WatchlistQueueOperation;
}

async function persist(pending: WatchlistQueueOperation[]): Promise<void> {
  const write = storageWriteTail.then(() =>
    AsyncStorage.setItem(WATCHLIST_QUEUE_STORAGE_KEY, JSON.stringify(pending)),
  );
  storageWriteTail = write.then(
    () => undefined,
    () => undefined,
  );
  await write;
}

function dedupeOperations(operations: WatchlistQueueOperation[]): WatchlistQueueOperation[] {
  const seen = new Set<string>();
  const result: WatchlistQueueOperation[] = [];
  for (const operation of operations) {
    if (seen.has(operation.operationId)) continue;
    seen.add(operation.operationId);
    result.push(operation);
  }
  return result;
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

/** Apply one validated operation to Supabase. The returned row is used by the
 * store to preserve the existing online upsert return shape. */
export async function syncWatchlistOperation(operation: WatchlistQueueOperation): Promise<unknown> {
  const parsed = QueueOperationSchema.parse(operation) as WatchlistQueueOperation;

  if (!isSupabaseConfigured) return undefined;

  if (parsed.type === 'upsert') {
    const { data, error } = await supabase
      .from('watchlist_items')
      .upsert(parsed.item, { onConflict: 'user_id,title_id' })
      .select(WATCHLIST_SELECT)
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  if (parsed.type === 'update') {
    const { error } = await supabase
      .from('watchlist_items')
      .update(parsed.updates)
      .eq('id', parsed.itemId);
    throwIfSupabaseError(error);
    return undefined;
  }

  const { error } = await supabase
    .from('watchlist_items')
    .update(parsed.updates)
    .eq('user_id', parsed.userId)
    .eq('title_id', parsed.titleId);
  throwIfSupabaseError(error);
  return undefined;
}

type WatchlistQueueState = {
  pending: WatchlistQueueOperation[];
  inFlight: boolean;
  lastError: string | null;
  enqueue: (operation: WatchlistQueueOperationInput) => Promise<void>;
  hydrate: () => Promise<void>;
  flush: () => Promise<void>;
};

export const useWatchlistQueue = create<WatchlistQueueState>((set, get) => ({
  pending: [],
  inFlight: false,
  lastError: null,

  hydrate: async () => {
    try {
      // Wait for a prior write before reading, otherwise a reconnect can read
      // an older snapshot while an enqueue/removal is still being persisted.
      await storageWriteTail;
      const raw = await AsyncStorage.getItem(WATCHLIST_QUEUE_STORAGE_KEY);
      if (!raw) {
        set({ pending: [] });
        return;
      }

      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch (error) {
        set({ pending: [] });
        await persist([]);
        logger.warn('watchlist.queue hydrate quarantined malformed payload', {
          message: errorMessage(error),
        });
        return;
      }

      if (!Array.isArray(value)) {
        set({ pending: [] });
        await persist([]);
        logger.warn('watchlist.queue hydrate quarantined non-array payload', {
          message: 'persisted queue payload must be an array',
        });
        return;
      }

      const valid: WatchlistQueueOperation[] = [];
      let malformed = false;
      for (const candidate of value) {
        const parsed = QueueOperationSchema.safeParse(candidate);
        if (parsed.success) valid.push(parsed.data as WatchlistQueueOperation);
        else malformed = true;
      }

      const deduped = dedupeOperations(valid);
      if (malformed || deduped.length !== valid.length) {
        await persist(deduped);
        logger.warn('watchlist.queue hydrate quarantined malformed entries', {
          message: 'persisted queue contains invalid or duplicate operations',
        });
      }
      set({ pending: deduped });
    } catch (error) {
      logger.warn('watchlist.queue hydrate failed', { message: errorMessage(error) });
    }
  },

  enqueue: async (input) => {
    const operation = createWatchlistQueueOperation(input);
    await get().hydrate();
    if (get().pending.some((item) => item.operationId === operation.operationId)) return;

    const next = [...get().pending, operation];
    await persist(next);
    set({ pending: next, lastError: null });
  },

  flush: async () => {
    if (!isSupabaseConfigured) return;
    if (get().inFlight) return;

    await get().hydrate();
    if (get().pending.length === 0) return;

    set({ inFlight: true, lastError: null });
    let backoff = 1000;
    try {
      while (get().pending.length > 0) {
        const head = get().pending[0];
        if (!head) break;

        try {
          await syncWatchlistOperation(head);
          const next = get().pending.slice(1);
          await persist(next);
          set({ pending: next });
          backoff = 1000;
        } catch (error) {
          const message = errorMessage(error);
          set({ lastError: message });
          logger.warn('watchlist.queue flush failed; will retry', { message });
          // Keep the head in storage. The next boot/reconnect/read retries it
          // in FIFO order, with bounded backoff matching the swipe queue.
          await new Promise((resolve) => setTimeout(resolve, backoff));
          backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
          break;
        }
      }
    } finally {
      set({ inFlight: false });
    }
  },
}));

/** Plain functions for app bootstrap/reconnect code that is outside React. */
export const watchlistQueue = {
  enqueue: (operation: WatchlistQueueOperationInput) =>
    useWatchlistQueue.getState().enqueue(operation),
  hydrate: () => useWatchlistQueue.getState().hydrate(),
  flush: () => useWatchlistQueue.getState().flush(),
};
