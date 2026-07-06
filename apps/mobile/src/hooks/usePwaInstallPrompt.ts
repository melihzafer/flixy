import { useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isInInstallCooldown,
  recordInstallAccepted,
  recordInstallDismissed,
} from '../lib/pwaInstall';
import { isIosWebBrowser, isStandaloneDisplayMode, isWebPlatform } from '../lib/pwaInstallPlatform';

type BeforeInstallPromptEvent = Event & {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
};

export type PwaInstallPlatform = 'chromium' | 'ios';

/** Wait for onboarding value before asking, per the UX research: never on the first paint. */
const SHOW_DELAY_MS = 4000;

/**
 * Only offer the install prompt on the main tabs (deck/watchlist/search/profile).
 * Never during auth, onboarding, paywall, or any other single-purpose modal screen.
 */
function isOnEligibleScreen(segments: string[]): boolean {
  return segments[0] === '(app)' && segments[1] === '(tabs)';
}

export function usePwaInstallPrompt() {
  const segments = useSegments() as unknown as string[];
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<PwaInstallPlatform | null>(null);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const shownThisSessionRef = useRef(false);
  const eligibleScreen = isOnEligibleScreen(segments);

  useEffect(() => {
    if (!isWebPlatform() || typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!isWebPlatform() || typeof window === 'undefined') return;
    if (shownThisSessionRef.current || !eligibleScreen) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || isStandaloneDisplayMode()) return;
        if (await isInInstallCooldown(Date.now())) return;

        if (isIosWebBrowser()) {
          shownThisSessionRef.current = true;
          setPlatform('ios');
          setVisible(true);
          return;
        }
        if (deferredPromptRef.current) {
          shownThisSessionRef.current = true;
          setPlatform('chromium');
          setVisible(true);
        }
      })();
    }, SHOW_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eligibleScreen]);

  const install = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) {
      setVisible(false);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredPromptRef.current = null;
    setVisible(false);
    if (choice.outcome === 'accepted') {
      await recordInstallAccepted();
    } else {
      await recordInstallDismissed(Date.now());
    }
  }, []);

  const dismiss = useCallback(async () => {
    setVisible(false);
    await recordInstallDismissed(Date.now());
  }, []);

  return { visible, platform, install, dismiss };
}
