import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSession } from '../../src/features/auth/useSession';
import { useUpdatePreferences } from '../../src/features/onboarding/hooks';
import { logger } from '../../src/lib/logger';
import {
  requestPermissionOnly,
  requestPushPermissionAndRegister,
} from '../../src/lib/notifications';

export default function NotificationsStep() {
  const { t } = useTranslation();
  const update = useUpdatePreferences();
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);

  const finish = (enabled: boolean) => {
    update.mutate(
      {
        notifications_enabled: enabled,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onSuccess: () => router.replace('/(app)') },
    );
  };

  const onAllow = async () => {
    setBusy(true);
    try {
      const userId = session?.user?.id;
      if (userId) {
        const token = await requestPushPermissionAndRegister(userId);
        finish(!!token);
      } else {
        const granted = await requestPermissionOnly();
        finish(granted);
      }
    } catch (e) {
      logger.warn('notifications.request failed', { message: (e as Error).message });
      finish(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={t('onboarding.notificationsTitle')}
      subtitle={t('onboarding.notificationsSubtitle')}
    >
      <Text variant="body-m" style={{ color: 'rgba(245,245,240,0.55)' }}>
        {t('onboarding.notificationsBody')}
      </Text>
      <View style={{ marginTop: 16, gap: 8 }}>
        <Button
          label={t('onboarding.notificationsAllow')}
          loading={busy || update.isPending}
          onPress={onAllow}
        />
        <Button
          label={t('onboarding.notificationsSkip')}
          variant="secondary"
          onPress={() => finish(false)}
        />
      </View>
    </Screen>
  );
}
