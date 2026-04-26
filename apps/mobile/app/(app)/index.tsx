import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSignOut } from '../../src/features/auth/hooks';
import { useSession } from '../../src/features/auth/useSession';
import { useAnonSwipeStore } from '../../src/stores/anonSwipe';

/**
 * Authenticated home placeholder. Real swipe deck lands in Phase 3.
 * Today this proves the auth round-trip and surfaces the upgrade prompt
 * when an anonymous user crosses the swipe threshold (FSD § 3.1.6).
 */
export default function Home() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const signOut = useSignOut();
  const { swipeCount, bumpSwipe, shouldPromptUpgrade, dismissPrompt, reset } = useAnonSwipeStore();

  const isAnon = session?.isAnonymous ?? false;
  const showPrompt = isAnon && shouldPromptUpgrade();

  return (
    <Screen title={t('app.name')} subtitle={t('app.tagline')}>
      <Text variant="body-m" style={{ color: '#A1A1AA' }}>
        {session?.user?.email ?? (isAnon ? 'Anonymous session' : 'No session')}
      </Text>

      {showPrompt ? (
        <View
          style={{ gap: 8, padding: 16, backgroundColor: '#15151B', borderRadius: 16 }}
          accessibilityRole="alert"
        >
          <Text variant="title-m">{t('auth.upgradeTitle')}</Text>
          <Text variant="body-m" style={{ color: '#A1A1AA' }}>
            {t('auth.upgradeSubtitle')}
          </Text>
          <Button label={t('auth.upgradeCta')} onPress={() => router.push('/(auth)/sign-up')} />
          <Button label={t('auth.notNow')} variant="ghost" onPress={dismissPrompt} />
        </View>
      ) : null}

      <View style={{ gap: 12, marginTop: 12 }}>
        <Button
          label={t('deck.title')}
          onPress={() => router.push('/(app)/deck')}
          testID="deck-button"
        />
        <Button
          label={t('search.title')}
          variant="secondary"
          onPress={() => router.push('/(app)/search')}
          testID="search-button"
        />
        <Button
          label={t('watchlist.title')}
          variant="secondary"
          onPress={() => router.push('/(app)/watchlist')}
          testID="watchlist-button"
        />
        <Button
          label={t('settings.profile')}
          variant="secondary"
          onPress={() => router.push('/(app)/profile')}
        />
        <Button
          label={t('settings.title')}
          variant="secondary"
          onPress={() => router.push('/(app)/settings')}
        />
        <Text variant="caption" style={{ color: '#71717A' }}>
          DEV · swipes simulated: {swipeCount}
        </Text>
        <Button label="Simulate swipe" variant="secondary" onPress={bumpSwipe} />
        <Button
          label={t('auth.signOut')}
          variant="ghost"
          loading={signOut.isPending}
          onPress={() => {
            reset();
            signOut.mutate();
          }}
        />
      </View>
    </Screen>
  );
}
