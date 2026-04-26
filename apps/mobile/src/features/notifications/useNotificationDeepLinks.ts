import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { logger } from '../../lib/logger';

/**
 * Listens for incoming push notifications and routes the user to the title
 * detail screen if the payload carries a `titleId`. Covers both cold-start
 * (last-response) and warm taps (subscribe).
 */
export function useNotificationDeepLinks() {
  useEffect(() => {
    let mounted = true;

    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (!mounted || !resp) return;
      handle(resp);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
}

function handle(resp: Notifications.NotificationResponse) {
  const data = resp.notification.request.content.data as { titleId?: string } | undefined;
  if (!data?.titleId) return;
  try {
    router.push({ pathname: '/(app)/title/[id]', params: { id: data.titleId } });
  } catch (err) {
    logger.warn('notif.deep_link_failed', { err: String(err) });
  }
}
