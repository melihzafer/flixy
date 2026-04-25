import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn;

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
    debug: false,
  });
}

export { Sentry };
