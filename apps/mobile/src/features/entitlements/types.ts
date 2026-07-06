export type PlanId = 'free' | 'bronze' | 'gold' | 'platinum';
export type DiscoveryMode =
  | 'main_deck'
  | 'cold_start'
  | 'blind_date'
  | 'streaming_roulette'
  | 'watchlist_triage'
  | 'trailers';

export type FlixyEntitlements = {
  daily_session_limit: number | null;
  cards_per_session: number | null;
  unlimited_discovery: boolean;
  basic_filters: boolean;
  extended_filters: boolean;
  advanced_filters: boolean;
  mood_filters: boolean;
  runtime_filters: boolean;
  country_language_filters: boolean;
  score_filters: boolean;
  blind_date_mode: 'none' | 'teaser' | 'full' | 'group';
  streaming_roulette: 'none' | 'teaser' | 'full' | 'group';
  watchlist_triage: 'none' | 'limited' | 'full' | 'smart';
  smart_watchlist: boolean;
  taste_profile_depth: 'basic' | 'standard' | 'deep' | 'group';
  smart_notifications: 'none' | 'basic' | 'basic_plus' | 'full' | 'shared';
  realtime_matching: boolean;
  shared_rooms: boolean;
  max_room_members: number;
  platinum_coming_soon: boolean;
};

export type EntitlementSnapshot = {
  plan_id: PlanId;
  entitlements: FlixyEntitlements;
};

export type DiscoverySessionResult =
  | (EntitlementSnapshot & {
      allowed: true;
      session_id: string;
      cards_limit: number | null;
      remaining_sessions: number | null;
      period_end: string;
    })
  | (EntitlementSnapshot & {
      allowed: false;
      reason: 'quota_exceeded';
      cards_limit: number | null;
      remaining_sessions: 0;
      period_end: string;
    });

export type PromoRedemptionReason =
  | 'auth_required'
  | 'invalid_promo_code'
  | 'promo_inactive'
  | 'promo_expired'
  | 'promo_sold_out'
  | 'promo_already_redeemed'
  | 'promo_unavailable'
  | 'promo_unknown_error';

export type PromoRedemptionSuccess = {
  ok: true;
  plan_id: PlanId;
  duration_days: number | null;
  current_period_end: string | null;
  subscription_id: string;
};

export type PromoRedemptionFailure = {
  ok: false;
  reason: PromoRedemptionReason;
};

export type PromoRedemptionResult = PromoRedemptionSuccess | PromoRedemptionFailure;
