import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '../src/features/auth/useSession';

/**
 * Auth gate: redirect to /(app) when authenticated (incl. anonymous), to
 * /(auth)/welcome otherwise. While Supabase rehydrates the session from
 * SecureStore we render a minimal spinner.
 */
export default function Index() {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B0B0F',
        }}
      >
        <ActivityIndicator color="#F5F5F7" />
      </View>
    );
  }

  if (data?.session) {
    return <Redirect href="/(app)" />;
  }
  return <Redirect href="/(auth)/welcome" />;
}
