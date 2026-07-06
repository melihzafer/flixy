import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { SwipeEvent } from '@flixy/shared';
import { SwipeEventSchema } from '@flixy/shared';

import { localDb } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { events } from '../telemetry/events';

/**
 * Swipe queue (FSD section 3.6.4). Every swipe is an immutable event with a
 * client-supplied UUID for idempotency. Events are persisted to AsyncStorage
 * before any network attempt so airplane-mode swipes survive a restart.
 *
 * Drain order: FIFO with exponential backoff on failure. A permanent failure
 * (auth gone) purges the queue and signs the user out — handled at the
 * useSession layer.
 */

const STORAGE_KEY = 'flixy.swipe_queue.v2';
const MAX_BACKOFF_MS = 30_000;

type QueueState = {
  pending: SwipeEvent[];
  inFlight: boolean;
  lastError: string | null;
  enqueue: (event: SwipeEvent) => Promise<void>;
  hydrate: () => Promise<void>;
  flush: () => Promise<void>;
  markUndone: (eventId: string) => Promise<void>;
};

async function persist(pending: SwipeEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch (e) {
    logger.warn('swipe.queue persist failed', { message: (e as Error).message });
  }
}

/**
 * Postgres error codes that will NEVER succeed on retry (constraint/typing/
 * policy violations). Retrying them forever used to wedge the whole FIFO
 * queue: one swipe with an invalid `session_id` (any surface outside a
 * discovery session, e.g. title detail, after migration 0024 added the
 * `swipes.session_id -> discovery_sessions` FK) blocked every later swipe
 * from syncing OR being written locally — which meant no exclusions and no
 * taste learning at all ("the movies I passed are being shown").
 */
const PERMANENT_SYNC_ERROR_CODES = new Set([
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '23514', // check_violation
  '22P02', // invalid_text_representation (bad uuid)
  '42501', // insufficient_privilege (RLS)
  '42703', // undefined_column
]);

export function isPermanentSwipeSyncError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && PERMANENT_SYNC_ERROR_CODES.has(code);
}

export async function syncSwipeEvent(ev: SwipeEvent & { genres?: string[] }): Promise<void> {
  // Local-first, unconditionally: the device's own swipe history (taste
  // signal, deck exclusions, quotas) must never depend on the network call
  // succeeding. insertSwipe upserts by event_id, so retries are idempotent.
  await localDb.insertSwipe({
    event_id: ev.eventId,
    user_id: ev.userId,
    title_id: ev.titleId,
    direction: ev.direction,
    occurred_at: ev.occurredAt,
    session_id: ev.sessionId,
    deck_position: ev.deckPosition,
    region: ev.region,
    filters_snapshot: ev.filtersSnapshot,
    genres: ev.genres,
  });

  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('swipes').insert({
    event_id: ev.eventId,
    user_id: ev.userId,
    title_id: ev.titleId,
    direction: ev.direction,
    occurred_at: ev.occurredAt,
    // Only a server-created discovery session id satisfies the FK on
    // swipes.session_id; app-launch session ids must sync as null.
    // Legacy queued events predating `discoverySessionId` also land on null.
    session_id: ev.discoverySessionId ?? null,
    deck_position: ev.deckPosition,
    region: ev.region,
    filters_snapshot: ev.filtersSnapshot,
  });
  if (!error) return;
  // event_id is the idempotency key. A duplicate means a previous ambiguous
  // request succeeded and the queue can safely advance.
  if (error.code === '23505') return;
  if (isPermanentSwipeSyncError(error)) {
    // The row can never be accepted as-is. The local copy above keeps
    // on-device personalization correct; drop the event from the queue
    // instead of blocking everything behind it forever.
    logger.warn('swipe sync rejected permanently; keeping local copy only', {
      code: error.code,
      message: error.message,
    });
    events.swipeSyncFailed({ reason: `permanent:${error.code}`, queued: 0 });
    return;
  }
  throw error;
}

export async function syncSwipeUndo(eventId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('swipes')
      .update({ is_undone: true })
      .eq('event_id', eventId);
    if (error) throw error;
  }
  await localDb.updateSwipe(eventId, { is_undone: true });
}

export const useSwipeQueue = create<QueueState>((set, get) => ({
  pending: [],
  inFlight: false,
  lastError: null,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      const valid: SwipeEvent[] = [];
      for (const item of arr) {
        const parsed = SwipeEventSchema.safeParse(item);
        if (parsed.success) valid.push(parsed.data);
      }
      set({ pending: valid });
      void get().flush();
    } catch (e) {
      logger.warn('swipe.queue hydrate failed', { message: (e as Error).message });
    }
  },

  enqueue: async (event) => {
    const next = [...get().pending, event];
    set({ pending: next });
    await persist(next);
    void get().flush();
  },

  flush: async () => {
    if (get().inFlight) return;
    set({ inFlight: true, lastError: null });
    let backoff = 1000;
    try {
      while (get().pending.length > 0) {
        const head = get().pending[0];
        if (!head) break;
        try {
          await syncSwipeEvent(head);
          const next = get().pending.slice(1);
          set({ pending: next });
          await persist(next);
          backoff = 1000;
        } catch (err) {
          const msg = (err as Error).message ?? 'unknown';
          set({ lastError: msg });
          logger.warn('swipe.flush failed; will retry', { message: msg });
          events.swipeSyncFailed({ reason: msg, queued: get().pending.length });
          await new Promise((r) => setTimeout(r, backoff));
          backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
          break;
        }
      }
    } finally {
      set({ inFlight: false });
    }
  },

  markUndone: async (eventId) => {
    await syncSwipeUndo(eventId);
  },
}));
