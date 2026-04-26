import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';

export default function OnboardingWelcome() {
  const { t } = useTranslation();
  return (
    <Screen title={t('onboarding.welcomeTitle')} subtitle={t('onboarding.welcomeSubtitle')}>
      <Text variant="body-m" style={{ color: '#A1A1AA' }}>
        {t('onboarding.welcomeBody')}
      </Text>
      <View style={{ marginTop: 16 }}>
        <Button
          label={t('common.getStarted')}
          onPress={() => router.push('/(onboarding)/region')}
        />
      </View>
    </Screen>
  );
}
