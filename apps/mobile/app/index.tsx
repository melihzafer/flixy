import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '../src/features/auth/useSession';
import { useOnboardingStatus } from '../src/features/onboarding/hooks';

function Spinner() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0B',
      }}
    >
      <ActivityIndicator color="#F5F5F0" />
    </View>
  );
}

/**
 * Root gate. Resolution order:
 *   1. session loading -> spinner
 *   2. no session -> /(auth)/welcome
 *   3. session + prefs loading -> spinner
 *   4. session + onboarding incomplete -> /(onboarding)/welcome
 *   5. session + onboarded -> /(app) (which renders the (tabs) group)
 */
export default function Index() {
  const { data, isLoading } = useSession();
  const { isLoading: prefsLoading, isOnboarded } = useOnboardingStatus();

  if (isLoading) return <Spinner />;
  if (!data?.session) return <Redirect href="/(auth)/welcome" />;
  if (prefsLoading) return <Spinner />;
  if (!isOnboarded) return <Redirect href="/(onboarding)/welcome" />;
  return <Redirect href="/(app)/(tabs)/deck" />;
}
