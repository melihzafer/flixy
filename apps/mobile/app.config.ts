import type { ExpoConfig } from 'expo/config';

declare const process: { env: Record<string, string | undefined> };

const config: ExpoConfig = {
  name: 'Flixy',
  slug: 'flixy',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'flixy',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0B',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.flixy.mobile',
    associatedDomains: ['applinks:flixy.app'],
  },
  android: {
    package: 'app.flixy.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0A0B',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'flixy.app' },
          { scheme: 'flixy', host: '*' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { bundler: 'metro', output: 'static' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-localization',
    'expo-web-browser',
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? 'o4511025219239936',
        project: process.env.SENTRY_PROJECT ?? 'flixy-mobile',
        url: 'https://de.sentry.io/',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0A0A0B',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EXPO_PROJECT_ID ?? '' },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseOAuthRedirectUri: process.env.EXPO_PUBLIC_SUPABASE_OAUTH_REDIRECT_URI,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    tmdbApiKey: process.env.TMDB_API_KEY,
    tmdbReadAccessToken: process.env.TMDB_READ_ACCESS_TOKEN,
    googleOAuthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
    googleOAuthRedirectUri:
      process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI ?? 'flixy://oauth/google',
  },
};

export default config;
