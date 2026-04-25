import { Fraunces_400Regular_Italic, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../src/i18n';
import '../src/theme/global.css';

import { queryClient, queryPersister } from '../src/lib/query';
import { initSentry } from '../src/lib/sentry';

void SplashScreen.preventAutoHideAsync();
initSentry();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_700Bold,
    Fraunces_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B0B0F' }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
        >
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0B0B0F' },
            }}
          />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
