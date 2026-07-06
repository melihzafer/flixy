import type { FlixyEntitlements, PlanId } from './types';

export type PremiumFeature =
  | 'advanced_filters'
  | 'blind_date'
  | 'streaming_roulette'
  | 'watchlist_triage'
  | 'smart_watchlist'
  | 'smart_notifications'
  | 'realtime_matching';

export type GateResult = {
  allowed: boolean;
  recommendedPlan: Exclude<PlanId, 'free' | 'platinum'> | 'platinum';
  message: string;
};

export function requireEntitlement(
  entitlements: FlixyEntitlements,
  feature: PremiumFeature,
): GateResult {
  const allowed = {
    advanced_filters: entitlements.advanced_filters,
    blind_date: entitlements.blind_date_mode !== 'none',
    streaming_roulette: entitlements.streaming_roulette !== 'none',
    watchlist_triage: entitlements.watchlist_triage !== 'none',
    smart_watchlist: entitlements.smart_watchlist,
    smart_notifications: ['full', 'shared'].includes(entitlements.smart_notifications),
    realtime_matching: entitlements.realtime_matching && !entitlements.platinum_coming_soon,
  }[feature];

  const goldFeature = ['advanced_filters', 'smart_watchlist', 'smart_notifications'].includes(
    feature,
  );
  const futureFeature = feature === 'realtime_matching';
  return {
    allowed,
    recommendedPlan: futureFeature ? 'platinum' : goldFeature ? 'gold' : 'bronze',
    message: futureFeature
      ? 'Flixy Platinum is coming later: realtime matching for couples, friends, and groups.'
      : 'Unlock sharper discovery with Flixy Bronze or Gold.',
  };
}

export function normalizeEntitlements(value: unknown): FlixyEntitlements | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FlixyEntitlements>;
  if (
    typeof candidate.unlimited_discovery !== 'boolean' ||
    typeof candidate.basic_filters !== 'boolean' ||
    typeof candidate.advanced_filters !== 'boolean' ||
    typeof candidate.blind_date_mode !== 'string'
  ) {
    return null;
  }
  return candidate as FlixyEntitlements;
}
