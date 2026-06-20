import { router } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from './useSession';

/**
 * Bounces the user off auth screens once they have a real (non-anonymous)
 * session. Closes the Android OAuth loop: WebBrowser can resolve with `dismiss`
 * before the deep-link callback fires, but onAuthStateChange writes the session
 * straight into the cache — this hook reacts to that and routes home.
 *
 * Anonymous sessions are intentionally allowed to remain on auth screens so a
 * preview user can upgrade to a real account via Google or email.
 */
export function useAuthRedirect() {
  const { data, isLoading } = useSession();
  const session = data?.session ?? null;
  const isAnonymous = data?.isAnonymous ?? false;

  useEffect(() => {
    if (isLoading) return;
    if (!session) return;
    if (isAnonymous) return;
    router.replace('/');
  }, [isLoading, session, isAnonymous]);
}
