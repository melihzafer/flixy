import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { SwipeEvent } from '@flixy/shared';
import { SwipeEventSchema } from '@flixy/shared';

import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';

/**
 * Swipe queue (FSD section 3.6.4). Every swipe is an immutable event with a
 * client-supplied UUID for idempotency. Events are persisted to AsyncStorage
 * before any network attempt so airplane-mode swipes survive a restart.
 *
 * Drain order: FIFO with exponential backoff on failure. A permanent failure
 * (auth gone) purges the queue and signs the user out — handled at the
 * useSession layer.
 */

const STORAGE_KEY = 'flixy.swipe_queue.v1';
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

async function postSwipe(ev: SwipeEvent): Promise<void> {
  const { error } = await supabase.from('swipes').upsert(
    {
      event_id: ev.eventId,
      user_id: ev.userId,
      title_id: ev.titleId,
      direction: ev.direction,
      occurred_at: ev.occurredAt,
      session_id: ev.sessionId,
      deck_position: ev.deckPosition,
      region: ev.region,
      filters_snapshot: ev.filtersSnapshot,
    },
    { onConflict: 'event_id', ignoreDuplicates: true },
  );
  if (error) throw error;
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
          await postSwipe(head);
          const next = get().pending.slice(1);
          set({ pending: next });
          await persist(next);
          backoff = 1000;
        } catch (err) {
          const msg = (err as Error).message ?? 'unknown';
          set({ lastError: msg });
          logger.warn('swipe.flush failed; will retry', { message: msg });
          await new Promise((r) => setTimeout(r, backoff));
          backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
          // Bail after one backoff cycle so the UI thread isn't blocked; the
          // next enqueue or NetInfo reconnect triggers another flush attempt.
          break;
        }
      }
    } finally {
      set({ inFlight: false });
    }
  },

  markUndone: async (eventId) => {
    // Compensating server-side update; preserved in history for analytics
    // (FSD section 3.6.3). Best-effort — failures are tolerated.
    const { error } = await supabase
      .from('swipes')
      .update({ is_undone: true })
      .eq('event_id', eventId);
    if (error) logger.warn('swipe.undo failed', { message: error.message });
  },
}));
