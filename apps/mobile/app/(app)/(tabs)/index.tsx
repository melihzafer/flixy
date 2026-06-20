import { Redirect } from 'expo-router';

/**
 * Root of the (tabs) group. Redirects to the Discover deck so users
 * land on the swipe surface directly.
 */
export default function AppIndex() {
  return <Redirect href="/(app)/(tabs)/deck" />;
}
