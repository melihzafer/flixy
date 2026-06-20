import * as Localization from 'expo-localization';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { LanguageCodeSchema, RegionCodeSchema } from '@flixy/shared';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useUpdateProfileRegion } from '../../src/features/onboarding/hooks';
import i18n from '../../src/i18n';
import { colors, fonts } from '../../src/theme/tokens';

const REGIONS = ['US', 'TR', 'BG', 'ES', 'DE', 'FR', 'BR'] as const;
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'bg', label: 'Български' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'pt-BR', label: 'Português (BR)' },
];

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
      {Array.from({ length: total }, (_, i) => `region-dot-${i}`).map((key, i) => (
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

export default function RegionStep() {
  const detected = useMemo(() => {
    const loc = Localization.getLocales()[0];
    const region = (loc?.regionCode ?? 'US').toUpperCase();
    const language = loc?.languageCode ?? 'en';
    return {
      region: RegionCodeSchema.safeParse(region).success ? region : 'US',
      language: LanguageCodeSchema.safeParse(language).success ? language : 'en',
    };
  }, []);

  const [region, setRegion] = useState(detected.region);
  const [language, setLanguage] = useState(detected.language);
  const update = useUpdateProfileRegion();

  const onContinue = () => {
    update.mutate(
      { region, language },
      {
        onSuccess: () => {
          void i18n.changeLanguage(language);
          router.push('/(onboarding)/services');
        },
      },
    );
  };

  return (
    <Screen scroll={false}>
      <Dots current={0} total={5} />

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
          Where are you{'\n'}watching from?
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
          This helps us show titles available in your region.
        </Text>

        <Text
          style={{
            fontSize: 10,
            fontFamily: fonts.bodySemi,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: 'rgba(245,245,240,0.3)',
            marginBottom: 10,
          }}
        >
          Region
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {REGIONS.map((r) => {
            const isOn = r === region;
            return (
              <Pressable
                key={r}
                onPress={() => setRegion(r)}
                style={{
                  height: 44,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isOn ? colors.accentBorder : colors.border,
                  backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: fonts.bodyMedium,
                    color: isOn ? colors.text : colors.textMuted,
                  }}
                >
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            fontSize: 10,
            fontFamily: fonts.bodySemi,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: 'rgba(245,245,240,0.3)',
            marginBottom: 10,
          }}
        >
          Language
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LANGUAGES.map((l) => {
            const isOn = l.code === language;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLanguage(l.code)}
                style={{
                  height: 44,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isOn ? colors.accentBorder : colors.border,
                  backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: fonts.bodyMedium,
                    color: isOn ? colors.text : colors.textMuted,
                  }}
                >
                  {l.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 32, marginTop: 'auto' }}>
        <Pressable
          onPress={onContinue}
          style={{
            width: '100%',
            height: 54,
            backgroundColor: colors.accent,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: update.isPending ? 0.7 : 1,
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
