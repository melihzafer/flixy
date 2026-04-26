import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { logger } from './logger';
import { supabase } from './supabase';

/**
 * Push notifications setup (FSD § 3.12).
 *
 * Gated to skip in Expo Go (SDK 53+ removed remote-push support there, and
 * statically importing expo-notifications triggers an auto-registration side
 * effect that throws). Use a development build to exercise the real path.
 */

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// biome-ignore lint/suspicious/noExplicitAny: dynamic require for Expo Go gating
function loadNotifications(): any | null {
  if (isExpoGo) return null;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic require for Expo Go gating
  return require('expo-notifications');
}

const Notifications = loadNotifications();

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

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
  if (categoriesRegistered || !Notifications) return;
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
  if (!Notifications) {
    logger.info('notif.skip_in_expo_go');
    return null;
  }
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

export async function requestPermissionOnly(): Promise<boolean> {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}
