import type {
  PlanId,
  PromoRedemptionFailure,
  PromoRedemptionReason,
  PromoRedemptionResult,
  PromoRedemptionSuccess,
} from './types';

const VALID_REDEMPTION_REASONS: PromoRedemptionReason[] = [
  'auth_required',
  'invalid_promo_code',
  'promo_inactive',
  'promo_expired',
  'promo_sold_out',
  'promo_already_redeemed',
  'promo_unavailable',
  'promo_unknown_error',
];

const VALID_REDEMPTION_PLANS: PlanId[] = ['free', 'bronze', 'gold', 'platinum'];

/**
 * Parses the raw JSONB returned by the `redeem_promo_code` RPC into a typed
 * result. Defends against missing/scalar-mismatched fields and unknown reason
 * strings so the UI never renders an unhandled shape.
 */
export function parseRedemptionResult(value: unknown): PromoRedemptionResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, reason: 'promo_unknown_error' };
  }
  const raw = value as {
    ok?: unknown;
    plan_id?: unknown;
    duration_days?: unknown;
    current_period_end?: unknown;
    subscription_id?: unknown;
    reason?: unknown;
  };
  if (raw.ok === true) {
    const plan = raw.plan_id;
    if (!VALID_REDEMPTION_PLANS.includes(plan as PlanId)) {
      return { ok: false, reason: 'promo_unknown_error' };
    }
    const periodEnd = raw.current_period_end;
    return {
      ok: true,
      plan_id: plan as PlanId,
      duration_days: typeof raw.duration_days === 'number' ? raw.duration_days : null,
      current_period_end: typeof periodEnd === 'string' ? periodEnd : null,
      subscription_id: typeof raw.subscription_id === 'string' ? raw.subscription_id : '',
    } satisfies PromoRedemptionSuccess;
  }
  const reason = String(raw.reason ?? 'promo_unknown_error');
  const normalized = VALID_REDEMPTION_REASONS.includes(reason as PromoRedemptionReason)
    ? (reason as PromoRedemptionReason)
    : 'promo_unknown_error';
  return { ok: false, reason: normalized } satisfies PromoRedemptionFailure;
}
