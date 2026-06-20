import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { logger } from '../../lib/logger';
import { completeOAuthCallbackUrl } from './oauthCallback';

/**
 * Listens for `flixy://...` deep links carrying an OAuth callback and turns
 * the callback URL into a Supabase session.
 *
 * `WebBrowser.openAuthSessionAsync` returns the redirect URL on iOS reliably,
 * but on Android the in-app browser sometimes hands the redirect off to the
 * system Linking handler instead of resolving the WebBrowser promise. This
 * hook catches both — cold-start (`getInitialURL`) and warm (`addEventListener`).
 */
export function useAuthDeepLink() {
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      try {
        const result = await completeOAuthCallbackUrl(url, 'deep_link');
        if (result.handled) {
          logger.info('auth.deeplink_callback completed', { flow: result.flow });
        }
      } catch (err) {
        logger.warn('auth.deeplink_callback threw', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (event) => {
      void handle(event.url);
    });
    return () => sub.remove();
  }, []);
}
