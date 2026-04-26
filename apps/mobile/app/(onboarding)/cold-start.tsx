import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useUpdatePreferences } from '../../src/features/onboarding/hooks';

/**
 * Cold-start placeholder. The real 10-card cold-start round (FSD § 3.2.5)
 * lands with the swipe engine in Phase 3. We mark it complete here so the
 * onboarding flow is unblocked end-to-end.
 */
export default function ColdStartStep() {
  const { t } = useTranslation();
  const update = useUpdatePreferences();

  const onContinue = () => {
    update.mutate(
      { cold_start_completed_at: new Date().toISOString() },
      { onSuccess: () => router.push('/(onboarding)/notifications') },
    );
  };

  return (
    <Screen title={t('onboarding.coldStartTitle')} subtitle={t('onboarding.coldStartSubtitle')}>
      <Text variant="body-m" style={{ color: '#A1A1AA' }}>
        {t('onboarding.coldStartPlaceholder')}
      </Text>
      <View style={{ marginTop: 16 }}>
        <Button label={t('common.continue')} loading={update.isPending} onPress={onContinue} />
      </View>
    </Screen>
  );
}
