import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { ONBOARDING } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Chip, ChipGroup } from '../../src/components/Chip';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useGenres, useUpdatePreferences } from '../../src/features/onboarding/hooks';

export default function GenresStep() {
  const { t } = useTranslation();
  const { data: genres, isLoading } = useGenres();
  const update = useUpdatePreferences();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= ONBOARDING.MAX_GENRES) return s;
      return [...s, id];
    });

  const canContinue =
    selected.length >= ONBOARDING.MIN_GENRES && selected.length <= ONBOARDING.MAX_GENRES;

  const onContinue = () => {
    update.mutate(
      { selected_genres: selected },
      { onSuccess: () => router.push('/(onboarding)/cold-start') },
    );
  };

  return (
    <Screen title={t('onboarding.genresTitle')} subtitle={t('onboarding.genresSubtitle')}>
      {isLoading ? (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator color="#F5F5F0" />
        </View>
      ) : (
        <ChipGroup>
          {(genres ?? []).map((g) => (
            <Chip
              key={g.id}
              label={t(`genres.${g.id}`, { defaultValue: g.id })}
              selected={selected.includes(g.id)}
              onPress={() => toggle(g.id)}
            />
          ))}
        </ChipGroup>
      )}

      <Text variant="body-s" style={{ color: 'rgba(245,245,240,0.55)', marginTop: 8 }}>
        {t('onboarding.genresHint', {
          min: ONBOARDING.MIN_GENRES,
          max: ONBOARDING.MAX_GENRES,
          count: selected.length,
        })}
      </Text>

      <View style={{ marginTop: 16 }}>
        <Button
          label={t('common.continue')}
          disabled={!canContinue}
          loading={update.isPending}
          onPress={onContinue}
        />
      </View>
    </Screen>
  );
}
