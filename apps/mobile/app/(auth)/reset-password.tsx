import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ResetPasswordInput, ResetPasswordInputSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useResetPassword } from '../../src/features/auth/hooks';
import { useAuthRedirect } from '../../src/features/auth/useAuthRedirect';
import { colors, fonts } from '../../src/theme/tokens';

export default function ResetPassword() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reset = useResetPassword();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordInputSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  useAuthRedirect();

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
              {t('auth.resetPasswordTitle')}
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
              {t('auth.resetPasswordSubtitle')}
            </Text>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}>
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
                  error={errors.email?.message ?? null}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <Input
                  label={t('auth.newPassword')}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="newPassword"
                  error={errors.password?.message ?? null}
                />
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, value, onBlur } }) => (
                <Input
                  label={t('auth.confirmNewPassword')}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="newPassword"
                  error={errors.confirmPassword?.message ?? null}
                />
              )}
            />

            {reset.isSuccess ? (
              <Text
                style={{
                  fontSize: 13,
                  color: colors.right,
                  fontFamily: fonts.body,
                  textAlign: 'center',
                }}
              >
                {t('auth.resetPasswordSuccess')}
              </Text>
            ) : null}
            {reset.isError ? (
              <Text
                style={{
                  fontSize: 13,
                  color: colors.left,
                  fontFamily: fonts.body,
                  textAlign: 'center',
                }}
              >
                {(reset.error as Error).message}
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
            label={t('auth.resetPasswordCta')}
            loading={reset.isPending}
            onPress={handleSubmit((v) =>
              reset.mutate(v, {
                onSuccess: () => setTimeout(() => router.replace('/(auth)/sign-in'), 800),
              }),
            )}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
            onPress={() => router.back()}
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
              {t('common.back')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
