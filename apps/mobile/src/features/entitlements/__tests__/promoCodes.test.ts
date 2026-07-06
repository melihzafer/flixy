import { parseRedemptionResult } from '../promoCodes';
import type { PromoRedemptionResult } from '../types';

describe('parseRedemptionResult', () => {
  it('parses a perpetual Gold redemption (MZHUNLIMITED shape)', () => {
    const result = parseRedemptionResult({
      ok: true,
      plan_id: 'gold',
      duration_days: null,
      current_period_end: null,
      subscription_id: 'sub-123',
    });
    expect(result).toEqual({
      ok: true,
      plan_id: 'gold',
      duration_days: null,
      current_period_end: null,
      subscription_id: 'sub-123',
    });
  });

  it('parses a 30-day Gold redemption (MZH1 shape)', () => {
    const result = parseRedemptionResult({
      ok: true,
      plan_id: 'gold',
      duration_days: 30,
      current_period_end: '2026-08-05T12:00:00Z',
      subscription_id: 'sub-456',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan_id).toBe('gold');
      expect(result.duration_days).toBe(30);
      expect(result.current_period_end).toBe('2026-08-05T12:00:00Z');
    }
  });

  it('maps known failure reasons', () => {
    const cases: Array<[string, PromoRedemptionResult]> = [
      ['invalid_promo_code', { ok: false, reason: 'invalid_promo_code' }],
      ['promo_already_redeemed', { ok: false, reason: 'promo_already_redeemed' }],
      ['promo_expired', { ok: false, reason: 'promo_expired' }],
      ['promo_sold_out', { ok: false, reason: 'promo_sold_out' }],
      ['promo_inactive', { ok: false, reason: 'promo_inactive' }],
      ['auth_required', { ok: false, reason: 'auth_required' }],
    ];
    for (const [reason, expected] of cases) {
      expect(parseRedemptionResult({ ok: false, reason })).toEqual(expected);
    }
  });

  it('normalizes unknown failure reasons to promo_unknown_error', () => {
    expect(parseRedemptionResult({ ok: false, reason: 'something_unexpected' })).toEqual({
      ok: false,
      reason: 'promo_unknown_error',
    });
  });

  it('rejects a success payload with an invalid plan_id', () => {
    expect(parseRedemptionResult({ ok: true, plan_id: 'diamond', subscription_id: 'x' })).toEqual({
      ok: false,
      reason: 'promo_unknown_error',
    });
  });

  it('falls back to promo_unknown_error for non-object input', () => {
    expect(parseRedemptionResult(null)).toEqual({ ok: false, reason: 'promo_unknown_error' });
    expect(parseRedemptionResult(undefined)).toEqual({ ok: false, reason: 'promo_unknown_error' });
    expect(parseRedemptionResult('ok')).toEqual({ ok: false, reason: 'promo_unknown_error' });
  });

  it('coerces missing scalar fields on a success payload', () => {
    const result = parseRedemptionResult({ ok: true, plan_id: 'bronze' });
    expect(result).toEqual({
      ok: true,
      plan_id: 'bronze',
      duration_days: null,
      current_period_end: null,
      subscription_id: '',
    });
  });
});
