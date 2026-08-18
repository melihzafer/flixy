import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SwipeDirection, SwipeEvent, SwipeTitleSnapshot } from '@flixy/shared';

import { localDb } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { useUserPreferences } from '../onboarding/hooks';
import { useProfile } from '../profile/hooks';
import { events } from '../telemetry/events';
import { watchlistQueue } from '../watchlist/queue';
import { watchlistStore } from '../watchlist/store';
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
  /** Legacy caller support; prefer titleSnapshot. */
  genres?: string[];
  titleSnapshot?: SwipeTitleSnapshot;
  discoverySessionId?: string | null;
};

export const CARD_LIMITS = {
  hourly: 15,
  daily: 50,
} as const;

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
  const { data: profile } = useProfile();
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
        sessionId: args.discoverySessionId ?? sessionId,
        // Only a real discovery session id may sync to swipes.session_id
        // (FK to discovery_sessions since migration 0024). Swipes made
        // outside a discovery session (title detail, search) carry null.
        discoverySessionId: args.discoverySessionId ?? null,
        deckPosition: args.deckPosition,
        region: profile?.region || 'US',
        filtersSnapshot: {
          services: prefs?.selected_services ?? [],
          genres: prefs?.selected_genres ?? [],
        },
        genres: args.titleSnapshot?.genres ?? args.genres,
        titleSnapshot: args.titleSnapshot,
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
      try {
        if (args.direction === 'right' || args.direction === 'up') {
          const priority = args.direction === 'up' ? 'top' : 'normal';
          await watchlistStore.upsertWatchlistItem({
            user_id: userId,
            title_id: args.titleId,
            priority,
            position: 0,
            added_at: event.occurredAt,
            watched_at: null,
            removed_at: null,
          });
        }
        if (args.direction === 'down') {
          await watchlistStore.upsertWatchlistItem({
            user_id: userId,
            title_id: args.titleId,
            priority: 'normal',
            position: 0,
            added_at: event.occurredAt,
            watched_at: event.occurredAt,
            removed_at: null,
          });
        }
      } catch (error) {
        logger.warn('watchlist optimistic upsert failed', { message: (error as Error).message });
      }
      return event;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['taste_signal'] });
      qc.invalidateQueries({ queryKey: ['deck_exclusions'] });
      qc.invalidateQueries({ queryKey: ['swipes'] });
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
      try {
        if (event.direction === 'right' || event.direction === 'up') {
          await watchlistStore.updateWatchlistItemByTitle(userId, event.titleId, {
            removed_at: new Date().toISOString(),
          });
        }
        if (event.direction === 'down') {
          await watchlistStore.updateWatchlistItemByTitle(userId, event.titleId, {
            watched_at: null,
          });
        }
      } catch (error) {
        logger.warn('watchlist undo failed', { message: (error as Error).message });
      }
      await markUndone(event.eventId);
      events.swipeUndone(event.titleId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['taste_signal'] });
      qc.invalidateQueries({ queryKey: ['deck_exclusions'] });
      qc.invalidateQueries({ queryKey: ['swipes'] });
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
    void watchlistQueue.hydrate().then(() => watchlistQueue.flush());
    const id = setInterval(() => {
      void flush();
      void watchlistQueue.flush();
    }, 30_000);
    return () => clearInterval(id);
  }, [hydrate, flush]);
}

export function useNetworkOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let active = true;
    void NetInfo.fetch().then((state) => {
      if (active) setIsOnline(state.isConnected !== false);
    });
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return isOnline;
}

export function useSwipeStats() {
  const pending = useSwipeQueue((s) => s.pending);
  const inFlight = useSwipeQueue((s) => s.inFlight);
  const lastError = useSwipeQueue((s) => s.lastError);
  return useMemo(
    () => ({ queued: pending.length, syncing: inFlight, lastError }),
    [pending.length, inFlight, lastError],
  );
}

/**
 * Total committed swipes for the current user (excludes undone swipes).
 * Used for the Profile stats card so "Swipes" reflects real swipe history
 * instead of being derived from the watchlist count.
 */
export function useSwipeCount() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  return useQuery({
    queryKey: ['swipes', userId ?? 'anon', 'count'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return 0;
      const swipes = await localDb.getSwipes(userId);
      return swipes.filter((s) => !s.is_undone).length;
    },
  });
}

function startOfHourMs(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    0,
    0,
    0,
  ).getTime();
}

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}

async function getQuotaSwipeTimes(userId: string, dayStartIso: string): Promise<number[]> {
  // The local DB is written synchronously on every swipe (before the sync queue
  // flushes to Supabase), so it is the authoritative, immediate record of how
  // many cards the user burned this hour/day. Supabase can lag behind whenever
  // swipes are still queued, which is why the hourly limit appeared not to work.
  // We read both and keep whichever source reports MORE swipes — local covers
  // the current session, remote covers history synced from other devices.
  const dayStartMs = new Date(dayStartIso).getTime();

  const localSwipes = await localDb.getSwipes(userId);
  const localTimes = localSwipes
    .filter((swipe) => !swipe.is_undone)
    .map((swipe) => new Date(swipe.occurred_at).getTime())
    .filter((time) => Number.isFinite(time) && time >= dayStartMs);

  if (!isSupabaseConfigured) return localTimes;

  try {
    const { data, error } = await supabase
      .from('swipes')
      .select('occurred_at')
      .eq('user_id', userId)
      .eq('is_undone', false)
      .gte('occurred_at', dayStartIso);

    if (error) throw error;
    const remoteTimes = (data ?? [])
      .map((row) => new Date(String(row.occurred_at)).getTime())
      .filter((time) => Number.isFinite(time));
    return remoteTimes.length > localTimes.length ? remoteTimes : localTimes;
  } catch (error) {
    logger.warn('Supabase card quota query failed, using local swipe history', {
      message: (error as Error).message,
    });
    return localTimes;
  }
}

export function useCardQuota() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  return useQuery({
    queryKey: ['swipes', userId ?? 'anon', 'quota'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        return {
          hourlyUsed: 0,
          dailyUsed: 0,
          hourlyRemaining: CARD_LIMITS.hourly,
          dailyRemaining: CARD_LIMITS.daily,
          remaining: CARD_LIMITS.hourly,
          isLimited: false,
          nextResetAt: null as string | null,
        };
      }

      const now = new Date();
      const hourStart = startOfHourMs(now);
      const dayStart = startOfDayMs(now);
      const swipeTimes = await getQuotaSwipeTimes(userId, new Date(dayStart).toISOString());
      let hourlyUsed = 0;
      let dailyUsed = 0;

      for (const occurred of swipeTimes) {
        if (occurred >= dayStart) dailyUsed++;
        if (occurred >= hourStart) hourlyUsed++;
      }

      const hourlyRemaining = Math.max(0, CARD_LIMITS.hourly - hourlyUsed);
      const dailyRemaining = Math.max(0, CARD_LIMITS.daily - dailyUsed);
      const remaining = Math.min(hourlyRemaining, dailyRemaining);
      const nextReset =
        dailyRemaining <= 0
          ? new Date(dayStart + 24 * 60 * 60 * 1000)
          : hourlyRemaining <= 0
            ? new Date(hourStart + 60 * 60 * 1000)
            : null;

      return {
        hourlyUsed,
        dailyUsed,
        hourlyRemaining,
        dailyRemaining,
        remaining,
        isLimited: remaining <= 0,
        nextResetAt: nextReset?.toISOString() ?? null,
      };
    },
    staleTime: 15_000,
  });
}

export function useFlushOnReconnect(isOnline: boolean) {
  const flush = useSwipeQueue((s) => s.flush);
  const last = useRef(isOnline);
  useEffect(() => {
    if (!last.current && isOnline) {
      void flush();
      void watchlistQueue.flush();
    }
    last.current = isOnline;
  }, [isOnline, flush]);
}

export const __debug = {
  useSwipeQueue,
  useCallback,
};
