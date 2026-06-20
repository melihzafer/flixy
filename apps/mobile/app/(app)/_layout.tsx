import { Stack } from 'expo-router';

/**
 * (app) — root for the authenticated app shell.
 *
 * Wraps a Stack so that modal-style screens (settings, edit-profile,
 * title detail, privacy, terms) push onto this stack and the system
 * back button returns to the originating tab inside the (tabs) group.
 *
 * The (tabs) group is mounted as the initial screen of the Stack. Custom
 * tab bar chrome lives in `src/components/CustomTabBar.tsx` and is
 * rendered by the Tabs layout at (app)/(tabs)/_layout.tsx.
 */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0A0A0B' },
      }}
    />
  );
}
