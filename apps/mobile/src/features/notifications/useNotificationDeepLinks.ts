import Constants, { ExecutionEnvironment } from 'expo-constants';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { logger } from '../../lib/logger';

/**
 * Listens for incoming push notifications and routes the user to the title
 * detail screen if the payload carries a `titleId`. Covers both cold-start
 * (last-response) and warm taps (subscribe).
 *
 * Gated to skip in Expo Go (SDK 53+ removed remote-push support there and
 * importing expo-notifications triggers an auto-registration side-effect that
 * crashes). Use a development build to exercise the real path.
 */
export function useNotificationDeepLinks() {
  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ) {
      logger.info('notif.skip_unsupported_env');
      return;
    }

    let mounted = true;
    // Dynamic require avoids loading expo-notifications (and its
    // auto-registration side-effects) when running inside Expo Go.
    // biome-ignore lint/suspicious/noExplicitAny: dynamic require for Expo Go gating
    const Notifications: any = require('expo-notifications');

    Notifications.getLastNotificationResponseAsync().then((resp: unknown) => {
      if (!mounted || !resp) return;
      handle(resp as NotificationResponseLike);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
}

type NotificationResponseLike = {
  notification: { request: { content: { data?: { titleId?: string; url?: string } } } };
};

function handle(resp: NotificationResponseLike) {
  const data = resp.notification.request.content.data;
  if (!data) return;
  try {
    if (data.titleId) {
      router.push({ pathname: '/(app)/title/[id]', params: { id: data.titleId } });
    } else if (data.url) {
      router.push(data.url as Href);
    }
  } catch (err) {
    logger.warn('notif.deep_link_failed', { err: String(err) });
  }
}
