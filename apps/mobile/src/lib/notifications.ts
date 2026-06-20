import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { logger } from './logger';

/**
 * Push notifications setup (FSD § 3.12).
 *
 * Gated to skip in Expo Go (SDK 53+ removed remote-push support there, and
 * statically importing expo-notifications triggers an auto-registration side
 * effect that throws). Use a development build to exercise the real path.
 */

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isWeb = Platform.OS === 'web';

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  if (isExpoGo || isWeb) return null;
  return require('expo-notifications') as NotificationsModule;
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

export async function scheduleWeeklyReminder(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'watchlist_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Watchlist is waiting!',
        body: 'You have films waiting to be watched. Let’s find the perfect one for tonight!',
        data: { type: 'watchlist_reminder', url: '/(app)/watchlist' },
        categoryIdentifier: 'flixy.weekly_picks',
      },
      trigger: {
        // biome-ignore lint/suspicious/noExplicitAny: SDK 54 time-interval trigger requires a discriminator the local types did not yet pick up.
        ...({ type: 'timeInterval', seconds: 7 * 24 * 60 * 60, repeats: true } as any),
      },
    });
    logger.info('notif.weekly_reminder_scheduled', { identifier });
    return identifier;
  } catch (err) {
    logger.warn('notif.schedule_weekly_reminder_failed', { err: String(err) });
    return null;
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

  // Schedule weekly reminder
  await scheduleWeeklyReminder();

  try {
    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;
    logger.info('notif.token_registered_locally', { userId, token });
    return token;
  } catch (err) {
    logger.warn('notif.token_get_failed_using_local_token', { err: String(err) });
    return 'local-token';
  }
}

export async function requestPermissionOnly(): Promise<boolean> {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  const granted = status === 'granted';
  if (granted) {
    await scheduleWeeklyReminder();
  }
  return granted;
}
