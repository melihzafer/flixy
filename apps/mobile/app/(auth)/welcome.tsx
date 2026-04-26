import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAnonymousSignIn } from '../../src/features/auth/hooks';

/**
 * Welcome screen — entry point for unauthenticated users (FSD § 3.1).
 * Offers anonymous swiping (no friction) plus standard sign-in / sign-up.
 */
export default function Welcome() {
  const { t } = useTranslation();
  const anon = useAnonymousSignIn();

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <Text variant="display-l">{t('app.name')}</Text>
        <Text variant="title-l" style={{ color: '#F5F5F7', marginTop: 8 }}>
          {t('auth.welcomeTitle')}
        </Text>
        <Text variant="body-l" style={{ color: '#A1A1AA' }}>
          {t('auth.welcomeSubtitle')}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Button
          label={t('auth.continueAnonymously')}
          loading={anon.isPending}
          onPress={() => {
            anon.mutate(undefined, {
              onSuccess: () => router.replace('/'),
            });
          }}
        />
        <Button
          label={t('auth.createAccount')}
          variant="secondary"
          onPress={() => router.push('/(auth)/sign-up')}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          <Text variant="body-m" style={{ color: '#A1A1AA' }}>
            {t('auth.haveAccount')}
          </Text>
          <Link href="/(auth)/sign-in">
            <Text variant="body-m" style={{ color: '#F5F5F7', fontWeight: '600' }}>
              {t('auth.signIn')}
            </Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
