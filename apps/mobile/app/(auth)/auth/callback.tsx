import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { completeOAuthCallbackUrl } from '@/features/auth/oauthCallback';
import { useSession } from '@/features/auth/useSession';
import { logger } from '@/lib/logger';

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const { data: sessionData } = useSession();

  // If a session is already present, immediately redirect to root
  useEffect(() => {
    if (sessionData?.session) {
      logger.info('auth.callback: active session detected, redirecting to root');
      router.replace('/');
    }
  }, [sessionData, router]);

  // Handle the incoming callback URL
  useEffect(() => {
    let active = true;

    async function handleCallback() {
      if (!url) return;

      try {
        logger.info('auth.callback: processing URL', { url });
        const result = await completeOAuthCallbackUrl(url, 'deep_link');
        if (result.handled && active) {
          logger.info('auth.callback: session established, redirecting to root');
          router.replace('/');
        }
      } catch (err) {
        logger.warn('auth.callback: failed to complete callback', {
          message: err instanceof Error ? err.message : String(err),
        });
        if (active) {
          router.replace('/(auth)/welcome');
        }
      }
    }

    void handleCallback();

    return () => {
      active = false;
    };
  }, [url, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0B',
      }}
    >
      <ActivityIndicator color="#F5F5F0" size="large" />
    </View>
  );
}
