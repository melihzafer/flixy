import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from './logger';
import { supabase } from './supabase';

/**
 * Push notifications setup (FSD § 3.12).
 *
 * Token registration writes the Expo push token + platform to a
 * `user_push_tokens` table keyed by (user_id, token). Categories are declared
 * once on app start so the OS can present the inline actions documented in
 * FSD § 3.12.3.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CATEGORIES = [
  {
    identifier: 'flixy.weekly_picks',
    actions: [
      { identifier: 'view', buttonTitle: 'View', options: { opensAppToForeground: true } },
      { identifier: 'dismiss', buttonTitle: 'Dismiss', options: { isDestructive: true } },
    ],
  },
  {
    identifier: 'flixy.new_for_you',
    actions: [{ identifier: 'open', buttonTitle: 'Open', options: { opensAppToForeground: true } }],
  },
];

let categoriesRegistered = false;

export async function ensureNotificationCategories(): Promise<void> {
  if (categoriesRegistered) return;
  try {
    for (const c of CATEGORIES) {
      await Notifications.setNotificationCategoryAsync(c.identifier, c.actions);
    }
    categoriesRegistered = true;
  } catch (err) {
    logger.warn('notif.categories_failed', { err: String(err) });
  }
}

export async function requestPushPermissionAndRegister(userId: string): Promise<string | null> {
  await ensureNotificationCategories();
  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) {
    logger.info('notif.permission_denied');
    return null;
  }
  try {
    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'user_id,token' });
    if (error) {
      logger.warn('notif.token_persist_failed', { err: error.message });
    }
    return token;
  } catch (err) {
    logger.warn('notif.token_get_failed', { err: String(err) });
    return null;
  }
}
