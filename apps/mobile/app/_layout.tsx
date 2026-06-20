import '../src/lib/silenceWarnings';

import { Damion_400Regular } from '@expo-google-fonts/damion';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_600SemiBold_Italic,
  Newsreader_700Bold_Italic,
  Newsreader_800ExtraBold_Italic,
} from '@expo-google-fonts/newsreader';
import { PlayfairDisplay_900Black_Italic } from '@expo-google-fonts/playfair-display';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
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

function AppSideEffects() {
  useAuthDeepLink();
  useI18nLanguage();
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
        >
          <AppSideEffects />
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
