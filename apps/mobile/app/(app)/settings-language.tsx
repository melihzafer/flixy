import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SelectOption, SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useUpdateProfileRegion } from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';
import i18n, { isLanguageEnabled } from '../../src/i18n';

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
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfileRegion();
  const currentRegion = profile?.region;
  const currentLanguage = profile?.language;

  return (
    <SettingsPage
      title={t('settingsPages.language.title', 'Language')}
      subtitle={t('settingsPages.language.subtitle', 'Controls app copy and catalogue preference.')}
    >
      {isLoading || !currentRegion || !currentLanguage ? (
        <Text tone="muted">{t('common.loading')}</Text>
      ) : (
        LANGUAGES.map((language) => {
          const enabled = isLanguageEnabled(language.code);
          return (
            <SelectOption
              key={language.code}
              label={language.label}
              description={enabled ? language.code : t('common.comingSoon', 'Soon')}
              selected={language.code === currentLanguage}
              disabled={!enabled || update.isPending}
              onPress={() => {
                if (!enabled) return;
                update.mutate(
                  { region: currentRegion, language: language.code },
                  {
                    onSuccess: () => {
                      void i18n.changeLanguage(language.code);
                      router.back();
                    },
                  },
                );
              }}
            />
          );
        })
      )}
    </SettingsPage>
  );
}
