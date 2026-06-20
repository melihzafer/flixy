import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { logger } from '../lib/logger';

/**
 * Tracks lifetime anonymous swipe count locally so we can surface the
 * "create an account" upgrade prompt after the preview swipe allowance.
 *
 * Reset to 0 on signOut / upgrade. Persisted via AsyncStorage so the prompt
 * doesn't re-trigger on every cold start.
 */

const UPGRADE_THRESHOLD = 5;
const STORAGE_KEY = 'flixy.anon-swipe';

type AnonSwipeState = {
  swipeCount: number;
  promptDismissedAt: number | null;
  bumpSwipe: () => void;
  shouldPromptUpgrade: () => boolean;
  dismissPrompt: () => void;
  reset: () => void;
};

type PersistedAnonSwipeState = Pick<AnonSwipeState, 'swipeCount' | 'promptDismissedAt'>;

function readPersistedState(raw: string | null): PersistedAnonSwipeState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAnonSwipeState>;
    return {
      swipeCount: Number.isFinite(parsed.swipeCount) ? Number(parsed.swipeCount) : 0,
      promptDismissedAt:
        typeof parsed.promptDismissedAt === 'number' && Number.isFinite(parsed.promptDismissedAt)
          ? parsed.promptDismissedAt
          : null,
    };
  } catch (error) {
    logger.warn('anonSwipe.persistedState invalid', { message: (error as Error).message });
    return null;
  }
}

async function persistAnonSwipeState(state: PersistedAnonSwipeState) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.warn('anonSwipe.persist failed', { message: (error as Error).message });
  }
}

export const useAnonSwipeStore = create<AnonSwipeState>()((set, get) => ({
  swipeCount: 0,
  promptDismissedAt: null,
  bumpSwipe: () => {
    set((s) => ({ swipeCount: s.swipeCount + 1 }));
    const { swipeCount, promptDismissedAt } = get();
    void persistAnonSwipeState({ swipeCount, promptDismissedAt });
  },
  shouldPromptUpgrade: () => {
    const s = get();
    if (s.swipeCount < UPGRADE_THRESHOLD) return false;
    // Re-surface the prompt at most once per 24h after dismissal.
    if (s.promptDismissedAt && Date.now() - s.promptDismissedAt < 24 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  },
  dismissPrompt: () => {
    const promptDismissedAt = Date.now();
    set({ promptDismissedAt });
    void persistAnonSwipeState({ swipeCount: get().swipeCount, promptDismissedAt });
  },
  reset: () => {
    set({ swipeCount: 0, promptDismissedAt: null });
    void persistAnonSwipeState({ swipeCount: 0, promptDismissedAt: null });
  },
}));

void AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    const persisted = readPersistedState(raw);
    if (persisted) useAnonSwipeStore.setState(persisted);
  })
  .catch((error) => {
    logger.warn('anonSwipe.hydrate failed', { message: (error as Error).message });
  });

export const ANON_UPGRADE_THRESHOLD = UPGRADE_THRESHOLD;
