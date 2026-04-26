import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { SwipeDirection, SwipeEvent } from '@flixy/shared';

import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { useUserPreferences } from '../onboarding/hooks';
import { events } from '../telemetry/events';
import { useSwipeQueue } from './queue';

/**
 * High-level swipe API consumed by the deck screen. Wraps queue + haptics +
 * watchlist projection (right/up writes a `watchlist_items` row optimistically;
 * the queue handles the immutable swipe event separately).
 */

export type RecordSwipeArgs = {
  titleId: string;
  direction: SwipeDirection;
  deckPosition: number;
};

export function useSwipeSession() {
  // One session id per app launch; stable across the deck.
  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current == null) {
    sessionIdRef.current = Crypto.randomUUID();
  }
  return sessionIdRef.current;
}

function hapticFor(dir: SwipeDirection): Promise<void> {
  // FSD 4.4.2: directional haptic feedback. Reanimated UI-thread runs the
  // animation; haptics fire on the JS thread once the swipe commits.
  switch (dir) {
    case 'right':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'left':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'up':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'down':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function useRecordSwipe() {
  const { data: session } = useSession();
  const { data: prefs } = useUserPreferences();
  const sessionId = useSwipeSession();
  const enqueue = useSwipeQueue((s) => s.enqueue);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: RecordSwipeArgs): Promise<SwipeEvent> => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('not authenticated');
      const event: SwipeEvent = {
        eventId: Crypto.randomUUID(),
        userId,
        titleId: args.titleId,
        direction: args.direction,
        occurredAt: new Date().toISOString(),
        sessionId,
        deckPosition: args.deckPosition,
        region: 'US',
        filtersSnapshot: {
          services: prefs?.selected_services ?? [],
          genres: prefs?.selected_genres ?? [],
        },
      };
      void hapticFor(args.direction);
      await enqueue(event);
      events.swipeCommitted({
        titleId: args.titleId,
        direction: args.direction,
        deckPosition: args.deckPosition,
        mood: null,
      });

      // Optimistic projection into watchlist for positive swipes.
      if (args.direction === 'right' || args.direction === 'up') {
        const priority = args.direction === 'up' ? 'top' : 'normal';
        const { error } = await supabase.from('watchlist_items').upsert(
          {
            user_id: userId,
            title_id: args.titleId,
            priority,
            position: 0,
            added_at: event.occurredAt,
          },
          { onConflict: 'user_id,title_id' },
        );
        if (error) logger.warn('watchlist optimistic upsert failed', { message: error.message });
      }
      return event;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['taste_signal'] });
    },
  });
}

export function useUndoSwipe() {
  const { data: session } = useSession();
  const markUndone = useSwipeQueue((s) => s.markUndone);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: SwipeEvent) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('not authenticated');
      // Reverse the watchlist projection.
      if (event.direction === 'right' || event.direction === 'up') {
        const { error } = await supabase
          .from('watchlist_items')
          .update({ removed_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('title_id', event.titleId);
        if (error) logger.warn('watchlist undo failed', { message: error.message });
      }
      await markUndone(event.eventId);
      events.swipeUndone(event.titleId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['taste_signal'] });
    },
  });
}

/**
 * Boots the queue at app start: loads anything persisted offline and triggers
 * a drain. Mount this once near the auth boundary.
 */
export function useSwipeQueueBoot() {
  const hydrate = useSwipeQueue((s) => s.hydrate);
  const flush = useSwipeQueue((s) => s.flush);
  useEffect(() => {
    void hydrate();
    const id = setInterval(() => {
      void flush();
    }, 30_000);
    return () => clearInterval(id);
  }, [hydrate, flush]);
}

export function useSwipeStats() {
  const pending = useSwipeQueue((s) => s.pending);
  const inFlight = useSwipeQueue((s) => s.inFlight);
  return useMemo(() => ({ queued: pending.length, syncing: inFlight }), [pending.length, inFlight]);
}

export function useFlushOnReconnect(isOnline: boolean) {
  const flush = useSwipeQueue((s) => s.flush);
  const last = useRef(isOnline);
  useEffect(() => {
    if (!last.current && isOnline) void flush();
    last.current = isOnline;
  }, [isOnline, flush]);
}

export const __debug = {
  useSwipeQueue,
  useCallback,
};
