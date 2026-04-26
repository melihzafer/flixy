import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { ONBOARDING } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Chip, ChipGroup } from '../../src/components/Chip';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useStreamingServices, useUpdatePreferences } from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';

export default function ServicesStep() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: services, isLoading } = useStreamingServices(profile?.region);
  const update = useUpdatePreferences();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const canContinue = selected.length >= ONBOARDING.MIN_SERVICES;

  const onContinue = () => {
    update.mutate(
      { selected_services: selected },
      { onSuccess: () => router.push('/(onboarding)/genres') },
    );
  };

  return (
    <Screen title={t('onboarding.servicesTitle')} subtitle={t('onboarding.servicesSubtitle')}>
      {isLoading ? (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator color="#F5F5F7" />
        </View>
      ) : (
        <ChipGroup>
          {(services ?? []).map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              selected={selected.includes(s.id)}
              onPress={() => toggle(s.id)}
            />
          ))}
        </ChipGroup>
      )}

      <Text variant="body-s" style={{ color: '#A1A1AA', marginTop: 8 }}>
        {t('onboarding.servicesHint', { min: ONBOARDING.MIN_SERVICES })}
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
