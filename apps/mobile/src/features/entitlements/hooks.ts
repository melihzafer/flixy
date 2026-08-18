import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { events } from '../telemetry/events';
import { SAFE_FREE_SNAPSHOT } from './constants';
import { type PremiumFeature, normalizeEntitlements, requireEntitlement } from './entitlementGates';
import { parseRedemptionResult } from './promoCodes';
import type {
  DiscoveryMode,
  DiscoverySessionResult,
  EntitlementSnapshot,
  PlanId,
  PromoRedemptionResult,
} from './types';

function isOfflineLikeError(error: unknown): boolean {
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code.toUpperCase() : '';
  const status = candidate?.status;
  const message = typeof candidate?.message === 'string' ? candidate.message : String(error ?? '');
  return (
    (typeof status === 'number' && [408, 425, 429, 500, 502, 503, 504].includes(status)) ||
    ['ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', 'NETWORK_ERROR'].includes(code) ||
    /offline|network|fetch|connection|timeout|timed out|enotfound/i.test(message)
  );
}

function parseSnapshot(value: unknown): EntitlementSnapshot {
  if (!value || typeof value !== 'object') return SAFE_FREE_SNAPSHOT;
  const raw = value as { plan_id?: unknown; entitlements?: unknown };
  const plan = raw.plan_id;
  const entitlements = normalizeEntitlements(raw.entitlements);
  if (!entitlements || !['free', 'bronze', 'gold', 'platinum'].includes(String(plan))) {
    return SAFE_FREE_SNAPSHOT;
  }
  return { plan_id: plan as PlanId, entitlements };
}

export function useEntitlements() {
  const { data: auth } = useSession();
  const qc = useQueryClient();
  const queryKey = ['entitlements', auth?.user?.id ?? 'preview'] as const;
  return useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      if (!isSupabaseConfigured || !auth?.user) return SAFE_FREE_SNAPSHOT;
      try {
        const { data, error } = await supabase.rpc('get_my_entitlements');
        if (error) throw error;
        const snapshot = parseSnapshot(data);
        events.entitlementsLoaded(snapshot.plan_id);
        return snapshot;
      } catch (error) {
        logger.warn('entitlements load failed; using free access', {
          message: (error as Error).message,
        });
        // Never replace a known plan with the free fallback: react-query keeps
        // the last successful value when the queryFn throws, so rethrowing
        // preserves the paid snapshot (and the 7-day persisted copy) across an
        // offline refetch. Returning SAFE_FREE_SNAPSHOT here would poison both
        // caches and demote paying users client-side until the next success.
        if (qc.getQueryData<EntitlementSnapshot>(queryKey)) throw error;
        return SAFE_FREE_SNAPSHOT;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useStartDiscoverySession() {
  const { data: auth } = useSession();
  const entitlements = useEntitlements();
  return useMutation({
    mutationFn: async ({
      mode,
      requestedCards,
      anonymousDeviceId,
    }: {
      mode: DiscoveryMode;
      requestedCards?: number;
      anonymousDeviceId?: string;
    }): Promise<DiscoverySessionResult> => {
      events.discoverySessionStartRequested(mode);
      if (!isSupabaseConfigured || !auth?.user) {
        const now = new Date();
        const periodEnd = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
        ).toISOString();
        return {
          ...SAFE_FREE_SNAPSHOT,
          allowed: true,
          session_id: Crypto.randomUUID(),
          cards_limit: auth?.isAnonymous ? 8 : 12,
          remaining_sessions: null,
          period_end: periodEnd,
        };
      }
      try {
        const { data, error } = await supabase.rpc('start_discovery_session', {
          mode,
          requested_cards: requestedCards ?? null,
          anonymous_device_id: anonymousDeviceId ?? null,
        });
        if (error) throw error;
        const result = data as DiscoverySessionResult;
        if (result.allowed) events.discoverySessionStarted(mode, result.plan_id);
        else events.discoverySessionQuotaExceeded(mode, result.plan_id);
        return result;
      } catch (error) {
        if (!isOfflineLikeError(error)) throw error;
        const snapshot = entitlements.data ?? SAFE_FREE_SNAPSHOT;
        const now = new Date();
        const periodEnd = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
        ).toISOString();
        logger.warn('discovery session unavailable; using offline session', {
          message: (error as Error).message,
        });
        return {
          ...snapshot,
          allowed: true,
          offline: true,
          session_id: Crypto.randomUUID(),
          cards_limit: requestedCards ?? snapshot.entitlements.cards_per_session ?? 12,
          remaining_sessions: null,
          period_end: periodEnd,
        };
      }
    },
  });
}

export function useRequireEntitlement(feature: PremiumFeature) {
  const query = useEntitlements();
  return {
    ...requireEntitlement((query.data ?? SAFE_FREE_SNAPSHOT).entitlements, feature),
    isLoading: query.isLoading,
  };
}

export function useRedeemPromoCode() {
  const qc = useQueryClient();
  const { data: auth } = useSession();
  return useMutation({
    mutationFn: async ({ code }: { code: string }): Promise<PromoRedemptionResult> => {
      const trimmed = code.trim();
      if (!trimmed) return { ok: false, reason: 'invalid_promo_code' };
      if (!isSupabaseConfigured || !auth?.user) {
        return { ok: false, reason: 'promo_unavailable' };
      }
      if (auth.isAnonymous) {
        return { ok: false, reason: 'auth_required' };
      }
      const { data, error } = await supabase.rpc('redeem_promo_code', { input_code: trimmed });
      if (error) throw error;
      return parseRedemptionResult(data);
    },
    onSuccess: (result) => {
      if (result.ok) {
        events.promoCodeRedeemed(result.plan_id, result.duration_days);
        qc.invalidateQueries({ queryKey: ['entitlements'] });
      } else {
        events.promoCodeFailed(result.reason);
      }
    },
    onError: (error) => {
      logger.warn('promo redemption failed', { message: (error as Error).message });
      events.promoCodeFailed('promo_unknown_error');
    },
  });
}
