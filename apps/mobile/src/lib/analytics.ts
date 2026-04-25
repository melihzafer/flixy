import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  posthogKey?: string;
  posthogHost?: string;
};

export const posthog = extra.posthogKey
  ? new PostHog(extra.posthogKey, {
      host: extra.posthogHost ?? 'https://us.posthog.com',
    })
  : null;

export function track(event: string, properties?: Record<string, unknown>) {
  posthog?.capture(event, properties as Record<string, string | number | boolean | null>);
}
