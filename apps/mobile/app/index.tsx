import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../src/components/Text';

export default function Index() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-bg px-6"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      accessibilityRole="header"
    >
      <View className="flex-1 justify-center">
        <Text variant="display-l" accessibilityRole="text">
          {t('app.name')}
        </Text>
        <Text variant="title-m" style={{ marginTop: 8, color: '#A1A1AA' }}>
          {t('app.tagline')}
        </Text>
      </View>
      <Text variant="caption" style={{ color: '#71717A', textTransform: 'uppercase' }}>
        {t('smoke.ready')}
      </Text>
    </View>
  );
}
