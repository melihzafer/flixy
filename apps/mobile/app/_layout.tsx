import '../src/lib/silenceWarnings';

import { Damion_400Regular } from '@expo-google-fonts/damion/400Regular';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Newsreader_600SemiBold_Italic } from '@expo-google-fonts/newsreader/600SemiBold_Italic';
import { Newsreader_700Bold_Italic } from '@expo-google-fonts/newsreader/700Bold_Italic';
import { Newsreader_800ExtraBold_Italic } from '@expo-google-fonts/newsreader/800ExtraBold_Italic';
import { PlayfairDisplay_900Black_Italic } from '@expo-google-fonts/playfair-display/900Black_Italic';
import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../src/i18n';
import '../src/theme/global.css';

import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useAuthDeepLink } from '../src/features/auth/useAuthDeepLink';
import { useI18nLanguage } from '../src/features/auth/useI18nLanguage';
import { useSession } from '../src/features/auth/useSession';
import { queryClient, queryPersister } from '../src/lib/query';
import { initSentry } from '../src/lib/sentry';
import { colors } from '../src/theme/tokens';

void SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();
initSentry();

LogBox.ignoreLogs([
  /Method readAsStringAsync imported from "expo-file-system" is deprecated/,
  /Method writeAsStringAsync imported from "expo-file-system" is deprecated/,
]);

const NEVER_PERSIST_QUERY_ROOTS = new Set(['auth', 'deck_exclusions', 'taste_signal', 'swipes']);

function AppSideEffects() {
  useAuthDeepLink();
  useI18nLanguage();
  useEffect(() => {
    // Paint the root window (the area behind the system bars / gesture nav) dark
    // so the bottom never flashes white on Android. Config sets this for fresh
    // installs; this covers the running app without a native rebuild.
    void SystemUI.setBackgroundColorAsync('#0A0A0B');
  }, []);
  return null;
}

/**
 * Holds the native splash screen until the auth session has actually resolved,
 * so the user never sees the auth screen flash before being redirected home
 * (or vice-versa). A timeout guarantees the splash never gets stuck.
 */
function SplashGate() {
  const { isLoading: sessionLoading } = useSession();
  useEffect(() => {
    if (!sessionLoading) void SplashScreen.hideAsync();
  }, [sessionLoading]);
  useEffect(() => {
    const id = setTimeout(() => void SplashScreen.hideAsync(), 2500);
    return () => clearTimeout(id);
  }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_600SemiBold_Italic,
    Newsreader_700Bold_Italic,
    Newsreader_800ExtraBold_Italic,
    PlayfairDisplay_900Black_Italic,
    Damion_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: 1000 * 60 * 60 * 24 * 7,
            dehydrateOptions: {
              // Never persist:
              // - 'auth': a stale cached session would flash the wrong screen
              //   (auth ⇄ home) on launch before the live session resolves.
              // - 'deck_exclusions': its data holds Sets, which JSON-serialize
              //   to {} — a restored entry silently loses every exclusion AND
              //   skips the loading gate, so the deck composes with already
              //   swiped titles and visibly swaps them out seconds later.
              // - 'taste_signal' / 'swipes': derived from fast local storage
              //   reads (and time-bucketed quotas); persisting them only
              //   resurrects stale values that trigger a deck recompose.
              shouldDehydrateQuery: (query) =>
                !NEVER_PERSIST_QUERY_ROOTS.has(String(query.queryKey[0])) &&
                defaultShouldDehydrateQuery(query),
            },
          }}
        >
          <AppSideEffects />
          <SplashGate />
          <StatusBar style="light" />
          <ErrorBoundary>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            />
          </ErrorBoundary>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
