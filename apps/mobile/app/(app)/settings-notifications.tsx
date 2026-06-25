import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native';

import { SettingsRow } from '../../src/components/ListRow';
import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useUpdatePreferences, useUserPreferences } from '../../src/features/onboarding/hooks';
import { colors } from '../../src/theme/tokens';

export default function SettingsNotifications() {
  const { t } = useTranslation();
  const { data: prefs } = useUserPreferences();
  const update = useUpdatePreferences();
  const pushEnabled = !!prefs?.notifications_enabled;

  return (
    <SettingsPage
      title={t('settingsPages.notifications.title', 'Notifications')}
      subtitle={t(
        'settingsPages.notifications.subtitle',
        'Keep Flixy quiet by default. Turn on only the reminders you want.',
      )}
    >
      <SettingsRow
        label={t('settingsPages.notifications.push', 'Push')}
        value={pushEnabled ? t('profile.on', 'On') : t('profile.off', 'Off')}
        subtitle={t(
          'settingsPages.notifications.pushSub',
          'New availability and watchlist reminders.',
        )}
        accessibilityLabel={t('settingsPages.notifications.push', 'Push notifications')}
        trailing={
          <Switch
            value={pushEnabled}
            onValueChange={(value) => update.mutate({ notifications_enabled: value })}
            accessibilityLabel={t('settingsPages.notifications.push', 'Push notifications')}
            accessibilityState={{ checked: pushEnabled }}
            trackColor={{ false: colors.surface3, true: colors.accent }}
            thumbColor={colors.text}
          />
        }
      />
      {/* Coming-soon channel — clearly marked, no fake value (Nielsen #5). */}
      <SettingsRow
        label={t('settingsPages.notifications.email', 'Email')}
        subtitle={t(
          'settingsPages.notifications.emailComingSoon',
          'Email digests are coming soon.',
        )}
        disabled
        trailing={<Text tone="dim">{t('common.comingSoon', 'Soon')}</Text>}
      />
    </SettingsPage>
  );
}
