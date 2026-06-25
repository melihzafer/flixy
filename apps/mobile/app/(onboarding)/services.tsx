import { router } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useStreamingServices, useUpdatePreferences } from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';
import { FALLBACK_STREAMING_SERVICES } from '../../src/lib/fallbackCatalogue';
import { colors, fonts } from '../../src/theme/tokens';

function Dots({ current, total }: { current: number; total: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 5,
        marginBottom: 28,
        paddingHorizontal: 20,
        paddingTop: 20,
      }}
    >
      {Array.from({ length: total }, (_, i) => `service-dot-${i}`).map((key, i) => (
        <View
          key={key}
          style={{
            height: 3,
            borderRadius: 2,
            flex: 1,
            backgroundColor:
              i < current
                ? colors.accent
                : i === current
                  ? 'rgba(255,77,28,0.5)'
                  : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </View>
  );
}

export default function ServicesStep() {
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const region = profile?.region;
  const { data: services } = useStreamingServices(region);
  const update = useUpdatePreferences();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const onContinue = () => {
    const ids = Array.from(selected);
    update.mutate(
      { selected_services: ids },
      { onSuccess: () => router.push('/(onboarding)/genres') },
    );
  };

  const serviceOptions =
    services ??
    FALLBACK_STREAMING_SERVICES.filter((service) => service.regions.includes(region ?? 'US'));

  return (
    <Screen scroll={false}>
      <Dots current={1} total={5} />

      <View style={{ paddingHorizontal: 20, flex: 1 }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 30,
            color: colors.text,
            lineHeight: 34,
            marginBottom: 8,
          }}
        >
          What are you{'\n'}subscribed to?
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: 'rgba(245,245,240,0.45)',
            lineHeight: 20,
            marginBottom: 24,
            fontFamily: fonts.body,
          }}
        >
          Pick every service you have access to.
        </Text>

        {isProfileLoading || !region ? (
          <Text tone="muted">Loading services for your region…</Text>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {serviceOptions.map((service) => {
              const isOn = selected.has(service.id);
              return (
                <Pressable
                  key={service.id}
                  onPress={() => toggle(service.id)}
                  style={{
                    width: '48%',
                    minHeight: 54,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: isOn ? colors.accent : colors.border2,
                      backgroundColor: isOn ? colors.accent : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isOn ? <Check size={12} color={colors.onAccent} strokeWidth={3} /> : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {service.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 32, marginTop: 'auto' }}>
        <Pressable
          onPress={onContinue}
          disabled={selected.size === 0 || update.isPending || isProfileLoading || !region}
          style={{
            width: '100%',
            height: 54,
            backgroundColor: colors.accent,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity:
              selected.size === 0 || update.isPending || isProfileLoading || !region ? 0.3 : 1,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bodySemi,
              fontSize: 16,
              color: colors.onAccent,
            }}
          >
            Continue
          </Text>
          <ArrowRight size={18} color={colors.onAccent} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Screen>
  );
}
