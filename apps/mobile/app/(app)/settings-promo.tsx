import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSession } from '../../src/features/auth/useSession';
import { PLAN_NAMES } from '../../src/features/entitlements/constants';
import { useRedeemPromoCode } from '../../src/features/entitlements/hooks';
import type { PlanId, PromoRedemptionReason } from '../../src/features/entitlements/types';
import { events } from '../../src/features/telemetry/events';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';

const ERROR_KEYS: Record<PromoRedemptionReason, string> = {
  auth_required: 'settingsPages.promo.errors.auth_required',
  invalid_promo_code: 'settingsPages.promo.errors.invalid_promo_code',
  promo_inactive: 'settingsPages.promo.errors.promo_inactive',
  promo_expired: 'settingsPages.promo.errors.promo_expired',
  promo_sold_out: 'settingsPages.promo.errors.promo_sold_out',
  promo_already_redeemed: 'settingsPages.promo.errors.promo_already_redeemed',
  promo_unavailable: 'settingsPages.promo.errors.promo_unavailable',
  promo_unknown_error: 'settingsPages.promo.errors.promo_unknown_error',
};

export default function SettingsPromo() {
  const { data: auth } = useSession();
  const redeem = useRedeemPromoCode();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    planId: PlanId;
    days: number | null;
  } | null>(null);

  useEffect(() => {
    events.promoCodeScreenViewed();
  }, []);

  const isAnonymous = auth?.isAnonymous ?? false;
  const trimmedCode = code.trim();
  const canSubmit = trimmedCode.length > 0 && !redeem.isPending && !isAnonymous;

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);
    redeem.mutate(
      { code: trimmedCode },
      {
        onSuccess: (result) => {
          if (result.ok) {
            setSuccess({ planId: result.plan_id, days: result.duration_days });
          } else {
            setError(ERROR_KEYS[result.reason]);
          }
        },
        onError: () => setError(ERROR_KEYS.promo_unknown_error),
      },
    );
  };

  if (success) {
    return (
      <Screen scroll>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Sparkles size={28} color={colors.accent} />
          </View>
          <Text style={styles.successTitle}>{'You are unlocked'}</Text>
          <Text style={styles.successBody}>
            {success.days === null
              ? `Flixy ${PLAN_NAMES[success.planId]} is now active with no expiry.`
              : `Flixy ${PLAN_NAMES[success.planId]} is active for ${success.days} days.`}
          </Text>
          <View style={styles.successCta}>
            <Button label="Got it" variant="primary" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.body}>
        <View style={styles.headerGap}>
          <Text style={styles.title}>{'Promo code'}</Text>
          <Text style={styles.subtitle}>{'Redeem a code to unlock or extend a Flixy plan.'}</Text>
        </View>

        <Input
          label="Promo code"
          placeholder="Enter your code"
          value={code}
          onChangeText={(next) => {
            setCode(next.toUpperCase().replace(/\s+/g, ''));
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          error={error}
          editable={!redeem.isPending}
          accessibilityLabel="Promo code input"
        />

        {isAnonymous ? (
          <Text style={styles.anonHint}>{'Create an account first to redeem a promo code.'}</Text>
        ) : null}

        <Button
          label={redeem.isPending ? 'Redeeming' : 'Redeem code'}
          variant="primary"
          loading={redeem.isPending}
          disabled={!canSubmit}
          onPress={handleSubmit}
          testID="promo-redeem-button"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    gap: spacing[5],
    paddingBottom: spacing[8],
  },
  headerGap: { gap: spacing[2] },
  title: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  anonHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  successIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentDim,
  },
  successTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 26,
    letterSpacing: -0.4,
    lineHeight: 32,
    textAlign: 'center',
  },
  successBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  successCta: {
    minWidth: 200,
    marginTop: spacing[2],
  },
});
