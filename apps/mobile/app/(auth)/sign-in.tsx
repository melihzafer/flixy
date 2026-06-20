import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type SignInInput, SignInInputSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { SocialButton } from '../../src/components/SocialButton';
import { Text } from '../../src/components/Text';
import { useOAuthSignIn, useSignIn } from '../../src/features/auth/hooks';
import { useAuthRedirect } from '../../src/features/auth/useAuthRedirect';
import { colors, fonts } from '../../src/theme/tokens';

export default function SignIn() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const signIn = useSignIn();
  const oauth = useOAuthSignIn();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(SignInInputSchema),
    defaultValues: { email: '', password: '' },
  });

  useAuthRedirect();

  const onSubmit = (values: SignInInput) => {
    signIn.mutate(values, { onSuccess: () => router.replace('/') });
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 14 }}>
            <View
              style={{
                width: 82,
                height: 82,
                borderRadius: 26,
                backgroundColor: colors.accentDim,
                borderWidth: 1,
                borderColor: colors.accentBorder,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: fonts.display,
                  fontSize: 38,
                  lineHeight: 44,
                  color: colors.accent,
                  textAlign: 'center',
                  includeFontPadding: false,
                  textAlignVertical: 'center',
                }}
              >
                F
              </Text>
            </View>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 28,
                color: colors.text,
                lineHeight: 34,
                letterSpacing: -0.4,
              }}
            >
              {t('auth.signInTitle')}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                lineHeight: 20,
                fontFamily: fonts.body,
                maxWidth: 320,
              }}
            >
              {t('auth.signInSubtitle')}
            </Text>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}>
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
                  fontFamily: fonts.body,
                  textAlign: 'center',
                }}
              >
                {t('auth.errors.oauth')}
              </Text>
            ) : null}

            <View style={{ height: 8 }} />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value, onBlur } }) => (
                <Input
                  label={t('auth.email')}
                  placeholder={t('auth.emailPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  error={errors.email?.message ?? null}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <Input
                  label={t('auth.password')}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  showPasswordLabel={t('auth.showPassword')}
                  hidePasswordLabel={t('auth.hidePassword')}
                  error={errors.password?.message ?? null}
                />
              )}
            />

            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('auth.forgotPassword')}
              hitSlop={8}
              onPress={() => router.push('/(auth)/reset-password')}
              style={({ pressed }) => ({
                alignSelf: 'flex-end',
                paddingVertical: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 12,
                  color: colors.accent,
                }}
              >
                {t('auth.forgotPassword')}
              </Text>
            </Pressable>

            {signIn.isError ? (
              <Text
                style={{
                  fontSize: 13,
                  color: colors.left,
                  fontFamily: fonts.body,
                  textAlign: 'center',
                }}
              >
                {t('auth.errors.invalidCredentials')}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 12,
            gap: 8,
          }}
        >
          <Button
            label={t('auth.signIn')}
            loading={signIn.isPending}
            onPress={handleSubmit(onSubmit)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.signUpFree')}
            hitSlop={8}
            onPress={() => router.replace('/(auth)/sign-up')}
            style={({ pressed }) => ({
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                color: colors.textMuted,
              }}
            >
              {t('auth.noAccountQ')}{' '}
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  color: colors.accent,
                }}
              >
                {t('auth.signUpFree')}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
