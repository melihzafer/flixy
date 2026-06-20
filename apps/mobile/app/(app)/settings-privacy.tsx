import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { SettingsRow } from '../../src/components/ListRow';
import { SettingsPage } from '../../src/components/SettingsPage';
import { useDeleteLocalAccount } from '../../src/features/auth/hooks';

export default function SettingsPrivacy() {
  const { t } = useTranslation();
  const deleteAccount = useDeleteLocalAccount();

  const onDelete = () => {
    Alert.alert(
      t('settings.privacy.deleteTitle', 'Delete your account?'),
      t(
        'settings.privacy.deleteBody',
        'This permanently erases your profile, watchlist, swipe history, and saved login on this device. The action cannot be undone.',
      ),
      [
        { text: t('common.back', 'Back'), style: 'cancel' },
        {
          text: t('settings.privacy.deleteConfirm', 'Delete'),
          style: 'destructive',
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onSuccess: () => router.replace('/(auth)/welcome'),
            }),
        },
      ],
    );
  };

  return (
    <SettingsPage
      title={t('settingsPages.privacy.title', 'Privacy')}
      subtitle={t(
        'settingsPages.privacy.subtitle',
        'Your taste profile should help recommendations, not surprise you.',
      )}
    >
      <SettingsRow
        label={t('settingsPages.privacy.policy', 'Privacy policy')}
        value={t('settings.read', 'Read')}
        onPress={() => router.push('/(app)/privacy')}
      />
      <SettingsRow
        label={t('settingsPages.privacy.export', 'Export data')}
        value={t('settingsPages.privacy.deleteValue', 'Request')}
        subtitle={t(
          'settingsPages.privacy.exportSub',
          'Local export is not enabled yet. Wipe-and-reinstall to start fresh.',
        )}
      />
      <SettingsRow
        label={t('settingsPages.privacy.delete', 'Delete account')}
        value={
          deleteAccount.isPending
            ? t('settingsPages.privacy.deleting', 'Deleting')
            : t('settingsPages.privacy.deleteValue', 'Erase on this device')
        }
        tone="danger"
        subtitle={t(
          'settingsPages.privacy.deleteSub',
          'Removes your profile, watchlist, swipe history, and saved login on this device.',
        )}
        disabled={deleteAccount.isPending}
        onPress={onDelete}
        testID="settings-delete-account"
      />
    </SettingsPage>
  );
}
