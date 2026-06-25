import type { ExpoConfig } from 'expo/config';

declare const process: { env: Record<string, string | undefined> };
declare const console: { warn: (...args: unknown[]) => void };

// These values are read from `process.env` at BUILD time and baked into
// `extra` below. EAS cloud builds do NOT see the gitignored `.env.local`, so
// they must be provided as EAS environment variables scoped to the build
// profile's `environment` (see eas.json + docs/HUMAN_BLOCKERS.md HB-009).
// Warn loudly in the build log when a non-development build is missing the
// runtime credentials the app needs to reach TMDB/Supabase — otherwise the
// installed APK silently shows "couldn't connect to the server".
const appVariant = process.env.APP_VARIANT ?? 'development';
if (appVariant !== 'development') {
  const requiredRuntimeEnv = {
    TMDB_API_KEY: process.env.TMDB_API_KEY,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
  const missing = Object.entries(requiredRuntimeEnv)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    console.warn(
      `[flixy] WARNING: building "${appVariant}" without runtime env vars: ${missing.join(', ')}. The resulting build will not load catalogue data or connect to auth. Set them as EAS environment variables for this environment (see docs/HUMAN_BLOCKERS.md HB-009).`,
    );
  }
}

const config: ExpoConfig = {
  name: 'Flixy',
  slug: 'flixy',
  owner: 'zwolfe',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'flixy',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0A0A0B',
  androidNavigationBar: {
    barStyle: 'light-content',
    backgroundColor: '#0A0A0B',
  },
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
    eas: { projectId: process.env.EXPO_PROJECT_ID ?? 'c279a523-ab5e-4627-93d6-c35a56798d4f' },
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
