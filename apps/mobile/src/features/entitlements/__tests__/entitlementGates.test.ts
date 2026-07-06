import { FREE_ENTITLEMENTS, PLAN_CARDS } from '../constants';
import { requireEntitlement } from '../entitlementGates';

describe('entitlement gates', () => {
  it('keeps basic discovery available while recommending Gold for advanced filters', () => {
    expect(FREE_ENTITLEMENTS.basic_filters).toBe(true);
    expect(requireEntitlement(FREE_ENTITLEMENTS, 'advanced_filters')).toEqual({
      allowed: false,
      recommendedPlan: 'gold',
      message: 'Unlock sharper discovery with Flixy Bronze or Gold.',
    });
  });

  it('supports the free Blind Date teaser through entitlement data', () => {
    expect(FREE_ENTITLEMENTS.blind_date_mode).toBe('teaser');
    expect(requireEntitlement(FREE_ENTITLEMENTS, 'blind_date').allowed).toBe(true);
  });

  it('keeps Platinum visible but not purchasable', () => {
    const platinum = PLAN_CARDS.find((plan) => plan.id === 'platinum');
    expect(platinum).toMatchObject({ badge: 'Coming later', purchasable: false });
  });

  it('separates Bronze unlimited discovery from Gold smart access', () => {
    const bronze = {
      ...FREE_ENTITLEMENTS,
      daily_session_limit: null,
      cards_per_session: null,
      unlimited_discovery: true,
      extended_filters: true,
      blind_date_mode: 'full' as const,
      streaming_roulette: 'full' as const,
      watchlist_triage: 'full' as const,
      taste_profile_depth: 'standard' as const,
      smart_notifications: 'basic_plus' as const,
    };
    const gold = {
      ...bronze,
      advanced_filters: true,
      smart_watchlist: true,
      taste_profile_depth: 'deep' as const,
      smart_notifications: 'full' as const,
    };

    expect(bronze.unlimited_discovery).toBe(true);
    expect(requireEntitlement(bronze, 'advanced_filters').allowed).toBe(false);
    expect(requireEntitlement(gold, 'advanced_filters').allowed).toBe(true);
    expect(requireEntitlement(gold, 'smart_watchlist').allowed).toBe(true);
  });

  it('keeps future Platinum capabilities behind coming-soon state', () => {
    const platinum = {
      ...FREE_ENTITLEMENTS,
      unlimited_discovery: true,
      realtime_matching: true,
      shared_rooms: true,
      max_room_members: 6,
      platinum_coming_soon: true,
    };
    expect(requireEntitlement(platinum, 'realtime_matching')).toMatchObject({
      allowed: false,
      recommendedPlan: 'platinum',
    });
  });
});
