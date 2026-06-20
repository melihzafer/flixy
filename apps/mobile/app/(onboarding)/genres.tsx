import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ONBOARDING } from '@flixy/shared';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useGenres, useUpdatePreferences } from '../../src/features/onboarding/hooks';
import { FALLBACK_GENRES_PARSED } from '../../src/lib/fallbackCatalogue';
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
      {Array.from({ length: total }, (_, i) => `genre-dot-${i}`).map((key, i) => (
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

export default function GenresStep() {
  const { t } = useTranslation();
  const { data: genres } = useGenres();
  const update = useUpdatePreferences();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelected(next);
  };

  const canContinue = selected.size >= ONBOARDING.MIN_GENRES;

  const onContinue = () => {
    const ids = Array.from(selected).slice(0, ONBOARDING.MAX_GENRES);
    update.mutate(
      { selected_genres: ids },
      { onSuccess: () => router.push('/(onboarding)/cold-start') },
    );
  };

  const genreOptions = genres ?? FALLBACK_GENRES_PARSED;

  return (
    <Screen scroll={false}>
      <Dots current={2} total={5} />

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
          What do you love{'\n'}to watch?
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
          Pick at least 3 genres.
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 7,
            marginBottom: 16,
          }}
        >
          {genreOptions.map((genre) => {
            const isOn = selected.has(genre.id);
            const label = t(`genres.${genre.id}`, genre.id.replace(/_/g, ' '));
            return (
              <Pressable
                key={genre.id}
                onPress={() => toggle(genre.id)}
                style={{
                  minHeight: 34,
                  paddingHorizontal: 12,
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
                    fontFamily: fonts.bodySemi,
                    color: isOn ? colors.text : colors.textMuted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 32, marginTop: 'auto' }}>
        <Pressable
          onPress={onContinue}
          disabled={!canContinue || update.isPending}
          style={{
            width: '100%',
            height: 54,
            backgroundColor: colors.accent,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: !canContinue || update.isPending ? 0.3 : 1,
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
