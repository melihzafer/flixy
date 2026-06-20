import { posthog } from './analytics';

export const featureFlags = {
  newCatalogueSearch: 'new_catalogue_search',
  newDetailPage: 'new_detail_page',
  newProfileIa: 'new_profile_ia',
  nonBlockingSaveNudge: 'non_blocking_save_nudge',
  catalogueV2: 'flixy_catalogue_v2',
} as const;

type FeatureFlagKey = (typeof featureFlags)[keyof typeof featureFlags];
type FeatureFlagClient = {
  isFeatureEnabled?: (key: string) => boolean | Promise<boolean | undefined> | undefined;
};

export async function isFeatureEnabled(key: FeatureFlagKey, fallback = false): Promise<boolean> {
  const client = posthog as FeatureFlagClient | null;
  const value = client?.isFeatureEnabled?.(key);
  if (typeof value === 'boolean') return value;
  if (value && typeof value.then === 'function') return (await value) ?? fallback;
  return fallback;
}
