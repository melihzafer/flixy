import type { EntitlementSnapshot, FlixyEntitlements, PlanId } from './types';

export const FREE_ENTITLEMENTS: FlixyEntitlements = {
  daily_session_limit: 3,
  cards_per_session: 12,
  unlimited_discovery: false,
  basic_filters: true,
  extended_filters: false,
  advanced_filters: false,
  mood_filters: false,
  runtime_filters: false,
  country_language_filters: false,
  score_filters: false,
  blind_date_mode: 'teaser',
  streaming_roulette: 'teaser',
  watchlist_triage: 'limited',
  smart_watchlist: false,
  taste_profile_depth: 'basic',
  smart_notifications: 'basic',
  realtime_matching: false,
  shared_rooms: false,
  max_room_members: 1,
  platinum_coming_soon: false,
};

export const SAFE_FREE_SNAPSHOT: EntitlementSnapshot = {
  plan_id: 'free',
  entitlements: FREE_ENTITLEMENTS,
};

export const PLAN_NAMES: Record<PlanId, string> = {
  free: 'Free',
  bronze: 'Flixy Bronze',
  gold: 'Flixy Gold',
  platinum: 'Flixy Platinum',
};

export const PLAN_CARDS = [
  {
    id: 'bronze' as const,
    headline: 'Unlimited discovery',
    subtext: 'Swipe without daily limits.',
    benefits: [
      'Unlimited discovery sessions',
      'Unlimited Blind Date',
      'Unlimited Streaming Roulette',
      'Unlimited Watchlist Triage',
    ],
    purchasable: true,
  },
  {
    id: 'gold' as const,
    headline: 'Sharper picks',
    subtext: 'Advanced filters, smarter watchlist, better alerts.',
    benefits: [
      'Everything in Bronze',
      'Advanced filters',
      'Smart watchlist sorting',
      'Deep taste profile',
      'Smart notifications',
    ],
    badge: 'Best value',
    purchasable: true,
  },
  {
    id: 'platinum' as const,
    headline: 'Watch together',
    subtext: 'Realtime matching for couples, friends, and groups.',
    benefits: [
      'Everything in Gold',
      'Realtime watchlist matching',
      'Shared rooms',
      'Group swiping sessions',
    ],
    badge: 'Coming later',
    purchasable: false,
  },
] as const;
