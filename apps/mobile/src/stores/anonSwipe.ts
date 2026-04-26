import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Tracks lifetime anonymous swipe count locally so we can surface the
 * "create an account" upgrade prompt after ~15 swipes (FSD § 3.1.6).
 *
 * Reset to 0 on signOut / upgrade. Persisted via AsyncStorage so the prompt
 * doesn't re-trigger on every cold start.
 */

const UPGRADE_THRESHOLD = 15;

type AnonSwipeState = {
  swipeCount: number;
  promptDismissedAt: number | null;
  bumpSwipe: () => void;
  shouldPromptUpgrade: () => boolean;
  dismissPrompt: () => void;
  reset: () => void;
};

export const useAnonSwipeStore = create<AnonSwipeState>()(
  persist(
    (set, get) => ({
      swipeCount: 0,
      promptDismissedAt: null,
      bumpSwipe: () => set((s) => ({ swipeCount: s.swipeCount + 1 })),
      shouldPromptUpgrade: () => {
        const s = get();
        if (s.swipeCount < UPGRADE_THRESHOLD) return false;
        // Re-surface the prompt at most once per 24h after dismissal.
        if (s.promptDismissedAt && Date.now() - s.promptDismissedAt < 24 * 60 * 60 * 1000) {
          return false;
        }
        return true;
      },
      dismissPrompt: () => set({ promptDismissedAt: Date.now() }),
      reset: () => set({ swipeCount: 0, promptDismissedAt: null }),
    }),
    {
      name: 'flixy.anon-swipe',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const ANON_UPGRADE_THRESHOLD = UPGRADE_THRESHOLD;
