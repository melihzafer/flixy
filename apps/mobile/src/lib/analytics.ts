import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  posthogKey?: string;
  posthogHost?: string;
};

type AnalyticsProperties = Record<string, string | number | boolean | null>;

const canInitializePostHog = typeof window !== 'undefined';

export const posthog =
  extra.posthogKey && canInitializePostHog
    ? new PostHog(extra.posthogKey, {
        host: extra.posthogHost ?? 'https://us.posthog.com',
      })
    : null;

function toAnalyticsProperties(
  properties?: Record<string, unknown>,
): AnalyticsProperties | undefined {
  if (!properties) return undefined;
  const out: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[key] = value;
    }
  }
  return out;
}

export function track(event: string, properties?: Record<string, unknown>) {
  posthog?.capture(event, toAnalyticsProperties(properties));
}
