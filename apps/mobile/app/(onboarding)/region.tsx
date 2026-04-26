import * as Localization from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LanguageCodeSchema, RegionCodeSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Chip, ChipGroup } from '../../src/components/Chip';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useUpdateProfileRegion } from '../../src/features/onboarding/hooks';

const REGIONS = ['US', 'TR', 'BG', 'ES', 'DE', 'FR', 'BR'] as const;
const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'bg', label: 'Български' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'pt-BR', label: 'Português (BR)' },
];

export default function RegionStep() {
  const { t } = useTranslation();

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
    update.mutate({ region, language }, { onSuccess: () => router.push('/(onboarding)/services') });
  };

  return (
    <Screen title={t('onboarding.regionTitle')} subtitle={t('onboarding.regionSubtitle')}>
      <Text variant="caption" style={{ color: 'rgba(245,245,240,0.55)', marginTop: 8 }}>
        {t('onboarding.regionLabel')}
      </Text>
      <ChipGroup>
        {REGIONS.map((r) => (
          <Chip key={r} label={r} selected={r === region} onPress={() => setRegion(r)} />
        ))}
      </ChipGroup>

      <Text variant="caption" style={{ color: 'rgba(245,245,240,0.55)', marginTop: 16 }}>
        {t('onboarding.languageLabel')}
      </Text>
      <ChipGroup>
        {LANGUAGES.map((l) => (
          <Chip
            key={l.code}
            label={l.label}
            selected={l.code === language}
            onPress={() => setLanguage(l.code)}
          />
        ))}
      </ChipGroup>

      {update.isError ? (
        <Text variant="body-s" style={{ color: '#E05C4B' }}>
          {t('auth.errors.generic')}
        </Text>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Button label={t('common.continue')} loading={update.isPending} onPress={onContinue} />
      </View>
    </Screen>
  );
}
