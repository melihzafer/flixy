import { Tabs } from 'expo-router';

import { CustomTabBar } from '../../../src/components/CustomTabBar';
import { useNotificationDeepLinks } from '../../../src/features/notifications/useNotificationDeepLinks';

/**
 * (app)/(tabs) — the four visible main tabs (Discover, Watchlist, Search, Profile).
 *
 * Modal-style screens (settings, edit-profile, title detail, privacy, terms)
 * live as siblings of this folder in (app)/* and are pushed onto the
 * (app) Stack, so the system back button from a pushed modal returns to
 * whichever tab the user was on, instead of jumping to the Discover tab.
 */
export default function TabsLayout() {
  useNotificationDeepLinks();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="deck" options={{}} />
      <Tabs.Screen name="watchlist" options={{}} />
      <Tabs.Screen name="search" options={{}} />
      <Tabs.Screen name="profile" options={{}} />
    </Tabs>
  );
}
