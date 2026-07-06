import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * PWA "Add to Home Screen" install-prompt persistence.
 *
 * Pure storage/cooldown logic only — platform and browser detection (which
 * needs `Platform`/`window`/`navigator`) live in `pwaInstallPlatform.ts` so
 * this module stays free of react-native imports and unit-testable under
 * ts-jest without a native transform.
 */

const DISMISSED_AT_KEY = 'flixy.pwa_install.dismissed_at.v1';
const DISMISS_COUNT_KEY = 'flixy.pwa_install.dismiss_count.v1';
const ACCEPTED_KEY = 'flixy.pwa_install.accepted.v1';

const COOLDOWN_AFTER_FIRST_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const COOLDOWN_AFTER_REPEAT_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
const REPEAT_DISMISS_THRESHOLD = 2;

type PwaInstallState = {
  dismissedAt: number | null;
  dismissCount: number;
  accepted: boolean;
};

async function getInstallState(): Promise<PwaInstallState> {
  const [dismissedAt, dismissCount, accepted] = await Promise.all([
    AsyncStorage.getItem(DISMISSED_AT_KEY),
    AsyncStorage.getItem(DISMISS_COUNT_KEY),
    AsyncStorage.getItem(ACCEPTED_KEY),
  ]);
  return {
    dismissedAt: dismissedAt ? Number(dismissedAt) : null,
    dismissCount: dismissCount ? Number(dismissCount) : 0,
    accepted: accepted === '1',
  };
}

/** Whether the install modal should stay hidden right now, per past user choices. */
export async function isInInstallCooldown(nowMs: number): Promise<boolean> {
  const state = await getInstallState();
  if (state.accepted) return true;
  if (state.dismissedAt === null) return false;
  const cooldownMs =
    state.dismissCount >= REPEAT_DISMISS_THRESHOLD
      ? COOLDOWN_AFTER_REPEAT_DISMISS_MS
      : COOLDOWN_AFTER_FIRST_DISMISS_MS;
  return nowMs - state.dismissedAt < cooldownMs;
}

export async function recordInstallDismissed(nowMs: number): Promise<void> {
  const state = await getInstallState();
  await Promise.all([
    AsyncStorage.setItem(DISMISSED_AT_KEY, String(nowMs)),
    AsyncStorage.setItem(DISMISS_COUNT_KEY, String(state.dismissCount + 1)),
  ]);
}

export async function recordInstallAccepted(): Promise<void> {
  await AsyncStorage.setItem(ACCEPTED_KEY, '1');
}
