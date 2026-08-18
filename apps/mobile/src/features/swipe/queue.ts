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

async function isLocalSwipeUndone(userId: string, eventId: string): Promise<boolean> {
  const swipes = await localDb.getSwipes(userId);
  return swipes.some((swipe) => swipe.event_id === eventId && swipe.is_undone === true);
}

async function syncRemoteSwipeUndo(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('swipes')
    .update({ is_undone: true })
    .eq('event_id', eventId);
  if (error) throw error;
}

function toLocalSwipe(
  ev: SwipeEvent,
  isUndone: boolean,
  syncPending = true,
): Parameters<typeof localDb.insertSwipe>[0] {
  return {
    event_id: ev.eventId,
    user_id: ev.userId,
    title_id: ev.titleId,
    direction: ev.direction,
    occurred_at: ev.occurredAt,
    session_id: ev.sessionId,
    discovery_session_id: ev.discoverySessionId ?? null,
    deck_position: ev.deckPosition,
    region: ev.region,
    filters_snapshot: ev.filtersSnapshot,
    genres: ev.titleSnapshot?.genres ?? ev.genres,
    title_snapshot: ev.titleSnapshot
      ? {
          genres: ev.titleSnapshot.genres,
          language: ev.titleSnapshot.language,
          kind: ev.titleSnapshot.kind,
        }
      : undefined,
    is_undone: isUndone,
    sync_pending: syncPending,
  };
}

function localSwipeToEvent(
  swipe: Awaited<ReturnType<typeof localDb.getPendingSwipes>>[number],
): SwipeEvent | null {
  const parsed = SwipeEventSchema.safeParse({
    eventId: swipe.event_id,
    userId: swipe.user_id,
    titleId: swipe.title_id,
    direction: swipe.direction,
    occurredAt: swipe.occurred_at,
    sessionId: swipe.session_id,
    discoverySessionId: swipe.discovery_session_id ?? null,
    deckPosition: swipe.deck_position,
    region: swipe.region,
    filtersSnapshot: swipe.filters_snapshot,
    genres: swipe.genres,
    titleSnapshot: swipe.title_snapshot,
  });
  return parsed.success ? parsed.data : null;
}

export async function syncSwipeEvent(ev: SwipeEvent): Promise<void> {
  const localIsUndone = await isLocalSwipeUndone(ev.userId, ev.eventId);

  // Local-first, unconditionally: the device's own swipe history (taste
  // signal, deck exclusions, quotas) must never depend on the network call
  // succeeding. insertSwipe upserts by event_id, so retries are idempotent.
  await localDb.insertSwipe(toLocalSwipe(ev, localIsUndone));

  if (!isSupabaseConfigured) {
    await localDb.updateSwipe(ev.eventId, { sync_pending: false });
    return;
  }
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
    title_snapshot: ev.titleSnapshot ?? null,
    is_undone: localIsUndone,
  });
  if (!error) {
    // An undo can finish locally while the original insert is in flight. If
    // its remote update ran before the insert committed, repair the inserted
    // row after the insert succeeds.
    if (!localIsUndone && (await isLocalSwipeUndone(ev.userId, ev.eventId))) {
      await syncRemoteSwipeUndo(ev.eventId);
    }
    await localDb.updateSwipe(ev.eventId, { sync_pending: false });
    return;
  }
  // event_id is the idempotency key. A duplicate means a previous ambiguous
  // request succeeded and the queue can safely advance.
  if (error.code === '23505') {
    if (await isLocalSwipeUndone(ev.userId, ev.eventId)) {
      await syncRemoteSwipeUndo(ev.eventId);
    }
    await localDb.updateSwipe(ev.eventId, { sync_pending: false });
    return;
  }
  if (isPermanentSwipeSyncError(error)) {
    // The row can never be accepted as-is. The local copy above keeps
    // on-device personalization correct; drop the event from the queue
    // instead of blocking everything behind it forever.
    logger.warn('swipe sync rejected permanently; keeping local copy only', {
      code: error.code,
      message: error.message,
    });
    events.swipeSyncFailed({ reason: `permanent:${error.code}`, queued: 0 });
    await localDb.updateSwipe(ev.eventId, { sync_pending: false });
    return;
  }
  throw error;
}

export async function syncSwipeUndo(eventId: string): Promise<void> {
  await localDb.updateSwipe(eventId, { is_undone: true, sync_pending: true });
  if (isSupabaseConfigured) {
    try {
      await syncRemoteSwipeUndo(eventId);
    } catch (error) {
      // The local tombstone is the immediate source of truth. The original
      // swipe remains in the durable queue and will carry is_undone=true on
      // its next remote attempt, so an unavailable server must not block the
      // user from restoring the card locally.
      logger.warn('swipe undo remote sync deferred', {
        message: (error as Error).message,
      });
    }
  }
}

export const useSwipeQueue = create<QueueState>((set, get) => ({
  pending: [],
  inFlight: false,
  lastError: null,

  hydrate: async () => {
    const valid: SwipeEvent[] = [];
    let rewriteQueue = false;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        let arr: unknown;
        try {
          arr = JSON.parse(raw);
        } catch (e) {
          rewriteQueue = true;
          logger.warn('swipe.queue hydrate quarantined malformed payload', {
            message: (e as Error).message,
          });
          arr = [];
        }
        if (!Array.isArray(arr)) {
          rewriteQueue = true;
          logger.warn('swipe.queue hydrate quarantined non-array payload', {
            message: 'persisted queue payload must be an array',
          });
          arr = [];
        }
        const items = Array.isArray(arr) ? arr : [];
        for (const item of items) {
          const parsed = SwipeEventSchema.safeParse(item);
          if (parsed.success) valid.push(parsed.data);
          else rewriteQueue = true;
        }
      }
    } catch (e) {
      logger.warn('swipe.queue hydrate failed', { message: (e as Error).message });
      rewriteQueue = true;
    }

    try {
      const recovered = (await localDb.getPendingSwipes())
        .map(localSwipeToEvent)
        .filter((event): event is SwipeEvent => event !== null);
      const seen = new Set(valid.map((event) => event.eventId));
      for (const event of recovered) {
        if (seen.has(event.eventId)) continue;
        seen.add(event.eventId);
        valid.push(event);
        rewriteQueue = true;
      }
    } catch (e) {
      logger.warn('swipe.queue local recovery failed', { message: (e as Error).message });
    }

    set({ pending: valid });
    if (rewriteQueue) await persist(valid);
    if (valid.length > 0) void get().flush();
  },

  enqueue: async (event) => {
    // The local record is the second durable recovery path if AsyncStorage
    // rejects the queue write or the process dies before the queue is flushed.
    await localDb.insertSwipe(toLocalSwipe(event, false));
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
