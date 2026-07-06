import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock3, Crown, Infinity as InfinityIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { PLAN_CARDS } from '../../src/features/entitlements/constants';
import { events } from '../../src/features/telemetry/events';
import { colors, fonts } from '../../src/theme/tokens';

export default function PaywallScreen() {
  const { surface = 'upgrade' } = useLocalSearchParams<{ surface?: string }>();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    events.paywallViewed(surface);
  }, [surface]);

  return (
    <Screen scroll>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 36, gap: 22 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={{ color: colors.accent, fontFamily: fonts.bodySemi, letterSpacing: 1.2 }}>
            FLIXY
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close upgrade plans"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text style={{ color: colors.textMuted, fontFamily: fonts.bodySemi }}>Close</Text>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{ color: colors.text, fontFamily: fonts.display, fontSize: 38, lineHeight: 42 }}
          >
            Keep the reel moving.
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: fonts.body, lineHeight: 21 }}>
            Choose unlimited discovery, or make every recommendation sharper.
          </Text>
        </View>

        {PLAN_CARDS.map((plan) => {
          const isGold = plan.id === 'gold';
          const isFuture = !plan.purchasable;
          return (
            <View
              key={plan.id}
              testID={`paywall-plan-${plan.id}`}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: isGold ? colors.accentBorder : colors.border,
                backgroundColor: isGold ? colors.accentDim : colors.surface,
                padding: 18,
                gap: 13,
                opacity: isFuture ? 0.72 : 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {isFuture ? (
                  <Clock3 size={19} color={colors.textMuted} />
                ) : isGold ? (
                  <Crown size={19} color={colors.accent} />
                ) : (
                  <InfinityIcon size={19} color={colors.text} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontFamily: fonts.bodyBold, fontSize: 18 }}>
                    {plan.headline}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontFamily: fonts.body, marginTop: 3 }}>
                    {plan.subtext}
                  </Text>
                </View>
                {'badge' in plan && plan.badge ? (
                  <Text
                    style={{
                      color: isFuture ? colors.textMuted : colors.accent,
                      fontFamily: fonts.bodySemi,
                      fontSize: 11,
                    }}
                  >
                    {plan.badge}
                  </Text>
                ) : null}
              </View>
              <View style={{ gap: 7 }}>
                {plan.benefits.map((benefit) => (
                  <View
                    key={benefit}
                    style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
                  >
                    <Check size={14} color={isFuture ? colors.textMuted : colors.accent} />
                    <Text style={{ color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 }}>
                      {benefit}
                    </Text>
                  </View>
                ))}
              </View>
              {plan.purchasable ? (
                <Button
                  label={`Choose Flixy ${plan.id === 'gold' ? 'Gold' : 'Bronze'}`}
                  variant={isGold ? 'primary' : 'secondary'}
                  onPress={() => {
                    events.paywallPlanSelected(plan.id, surface);
                    setMessage('Purchases will open when store billing is connected.');
                  }}
                />
              ) : null}
            </View>
          );
        })}

        {message ? (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.textMuted, textAlign: 'center', fontFamily: fonts.body }}
          >
            {message}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
