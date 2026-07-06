import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SettingsRow } from '../../src/components/ListRow';
import { SettingsPage } from '../../src/components/SettingsPage';
import { useSignOut } from '../../src/features/auth/hooks';
import { useSession } from '../../src/features/auth/useSession';
import { PLAN_NAMES } from '../../src/features/entitlements/constants';
import { useEntitlements } from '../../src/features/entitlements/hooks';
import { events } from '../../src/features/telemetry/events';

const WELCOME_ROUTE = '/(auth)/welcome' as const;

export default function SettingsAccount() {
  const { t } = useTranslation();
  const { data: auth } = useSession();
  const { data: entitlementSnapshot } = useEntitlements();
  const signOut = useSignOut();
  const email = auth?.user?.email ?? t('settingsPages.account.noEmail', 'No email connected');
  const connected =
    auth?.user?.app_metadata?.provider ??
    (auth?.isAnonymous
      ? t('profile.row.accountPreview', 'Preview')
      : t('settingsPages.account.email', 'Email'));

  const handleSignOut = () => {
    events.settingsDetailOpened('sign_out');
    signOut.mutate(undefined, {
      onSuccess: () => {
        events.signedOut();
        router.replace(WELCOME_ROUTE);
      },
    });
  };

  return (
    <SettingsPage
      title={t('settingsPages.account.title', 'Account')}
      subtitle={t('settingsPages.account.subtitle', 'Manage sign-in and account access.')}
    >
      <SettingsRow
        label={t('settingsPages.account.email', 'Email')}
        value={email}
        valueNumberOfLines={1}
      />
      <SettingsRow
        label={t('settingsPages.account.connected', 'Connected accounts')}
        value={String(connected)}
      />
      <SettingsRow
        label={t('settingsPages.account.subscription', 'Subscription')}
        value={
          auth?.isAnonymous
            ? t('profile.row.accountPreview', 'Preview')
            : PLAN_NAMES[entitlementSnapshot?.plan_id ?? 'free']
        }
      />
      <SettingsRow
        label={t('settingsPages.account.changePassword', 'Change password')}
        value={t('settingsPages.account.changePasswordValue', 'On device')}
        onPress={() => router.push('/(app)/change-password')}
      />
      <SettingsRow
        label={t('auth.signOut', 'Sign out')}
        value={signOut.isPending ? t('settingsPages.account.signingOut', 'Signing out') : undefined}
        tone="danger"
        disabled={signOut.isPending}
        onPress={handleSignOut}
      />
    </SettingsPage>
  );
}
