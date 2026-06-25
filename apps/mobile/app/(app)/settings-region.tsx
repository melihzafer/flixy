import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SelectOption, SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useUpdateProfileRegion } from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';

const REGIONS = [
  { code: 'US', label: 'United States' },
  { code: 'TR', label: 'Türkiye' },
  { code: 'BG', label: 'Bulgaria' },
  { code: 'ES', label: 'Spain' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'BR', label: 'Brazil' },
] as const;

export default function SettingsRegion() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfileRegion();
  const currentRegion = profile?.region;
  const currentLanguage = profile?.language;

  return (
    <SettingsPage
      title={t('settingsPages.region.title', 'Region')}
      subtitle={t(
        'settingsPages.region.subtitle',
        'Used for streaming availability and catalogue relevance.',
      )}
    >
      {isLoading || !currentRegion || !currentLanguage ? (
        <Text tone="muted">{t('common.loading')}</Text>
      ) : (
        REGIONS.map((region) => (
          <SelectOption
            key={region.code}
            label={region.label}
            description={region.code}
            selected={region.code === currentRegion}
            disabled={update.isPending}
            onPress={() =>
              update.mutate(
                { region: region.code, language: currentLanguage },
                { onSuccess: () => router.back() },
              )
            }
          />
        ))
      )}
    </SettingsPage>
  );
}
