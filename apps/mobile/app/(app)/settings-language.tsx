import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SelectOption, SettingsPage } from '../../src/components/SettingsPage';
import { useUpdateProfileRegion } from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';
import i18n from '../../src/i18n';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'bg', label: 'Български' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
] as const;

export default function SettingsLanguage() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const update = useUpdateProfileRegion();
  const currentRegion = profile?.region ?? 'US';
  const currentLanguage = profile?.language ?? 'en';

  return (
    <SettingsPage
      title={t('settingsPages.language.title', 'Language')}
      subtitle={t('settingsPages.language.subtitle', 'Controls app copy and catalogue preference.')}
    >
      {LANGUAGES.map((language) => (
        <SelectOption
          key={language.code}
          label={language.label}
          description={language.code}
          selected={language.code === currentLanguage}
          disabled={update.isPending}
          onPress={() =>
            update.mutate(
              { region: currentRegion, language: language.code },
              {
                onSuccess: () => {
                  void i18n.changeLanguage(language.code);
                  router.back();
                },
              },
            )
          }
        />
      ))}
    </SettingsPage>
  );
}
