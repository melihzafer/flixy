import { useEffect } from 'react';

import i18n from '../../i18n';
import { useProfile } from '../profile/hooks';
import { useSession } from './useSession';

/**
 * Keeps i18next in sync with the profile's saved language. Runs once a
 * real session + profile is available, and re-runs whenever the saved
 * language changes. Falls back to no-op when the language is unknown.
 *
 * Mount this once near the auth boundary (e.g. in the root layout).
 */
export function useI18nLanguage() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!userId) return;
    const lang = profile?.language;
    if (!lang) return;
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang);
    }
  }, [userId, profile?.language]);
}
