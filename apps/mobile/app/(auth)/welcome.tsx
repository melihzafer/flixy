import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { SocialButton } from '../../src/components/SocialButton';
import { Text } from '../../src/components/Text';
import { useAnonymousSignIn, useOAuthSignIn } from '../../src/features/auth/hooks';
import { useAuthRedirect } from '../../src/features/auth/useAuthRedirect';
import { events } from '../../src/features/telemetry/events';
import { colors, fonts } from '../../src/theme/tokens';

export default function Welcome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const anon = useAnonymousSignIn();
  const oauth = useOAuthSignIn();

  useAuthRedirect();

  const handleAnon = () => {
    anon.mutate(undefined, { onSuccess: () => router.replace('/') });
  };

  return (
    <Screen scroll={false}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 170,
            height: 230,
            borderRadius: 34,
            backgroundColor: 'rgba(255,77,28,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,77,28,0.18)',
            transform: [{ rotate: '-7deg' }, { translateY: -18 }],
          }}
        />
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: fonts.display,
            fontSize: 74,
            color: colors.accent,
            lineHeight: 84,
            letterSpacing: -1.1,
            includeFontPadding: false,
            textAlignVertical: 'center',
            paddingHorizontal: 16,
          }}
        >
          Flixy
        </Text>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 24,
            color: colors.text,
            textAlign: 'center',
            lineHeight: 28,
          }}
        >
          {t('auth.tagline')}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 280,
            fontFamily: fonts.body,
          }}
        >
          {t('auth.welcomeSubtitle')}
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          gap: 12,
        }}
      >
        <Button
          label={t('auth.createAccount')}
          onPress={() => {
            events.authCreateAccountTapped('welcome');
            router.push('/(auth)/sign-up');
          }}
        />
        <SocialButton
          provider="google"
          label={t('auth.continueWithGoogle')}
          loading={oauth.isPending}
          onPress={() => oauth.mutate('google')}
        />
        {oauth.isError ? (
          <Text
            style={{
              fontSize: 12,
              color: colors.left,
              textAlign: 'center',
              fontFamily: fonts.body,
            }}
          >
            {t('auth.errors.oauth')}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.browseAnonymously')}
            onPress={handleAnon}
            disabled={anon.isPending}
            hitSlop={8}
            style={({ pressed }) => ({
              paddingVertical: 8,
              opacity: anon.isPending ? 0.5 : pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                color: colors.textMuted,
              }}
            >
              {t('auth.browseAnonymously')}
            </Text>
          </Pressable>
          <View
            style={{ width: 1, backgroundColor: 'rgba(245,245,240,0.14)', marginVertical: 8 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.signIn')}
            onPress={() => router.push('/(auth)/sign-in')}
            hitSlop={8}
            style={({ pressed }) => ({
              paddingVertical: 8,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: fonts.bodySemi,
                fontSize: 13,
                color: colors.accent,
              }}
            >
              {t('auth.signIn')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
