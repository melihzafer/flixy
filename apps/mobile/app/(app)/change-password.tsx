import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ResetPasswordInput, ResetPasswordInputSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useResetPassword } from '../../src/features/auth/hooks';
import { useSession } from '../../src/features/auth/useSession';
import { colors, fonts } from '../../src/theme/tokens';

/**
 * In-app change-password screen. Mirrors the auth flow's reset-password UX
 * but stays inside the (app) Stack so signed-in users don't get bounced
 * through the auth screen.
 */
export default function ChangePassword() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const reset = useResetPassword();
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordInputSchema),
    defaultValues: {
      email: session?.user?.email ?? '',
      password: '',
      confirmPassword: '',
    },
  });

  // Keep the form's email in sync with the active session so the user
  // doesn't have to retype it.
  if (session?.user?.email && control._formValues.email !== session.user.email) {
    setValue('email', session.user.email);
  }

  return (
    <SettingsPage
      title="Change password"
      subtitle="Set a new password for this device. Your existing data and watchlist stay put."
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 14 }}>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label={t('auth.email')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  editable={!session?.user?.email}
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
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label={t('auth.newPassword')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="newPassword"
                  showPasswordLabel={t('auth.showPassword')}
                  hidePasswordLabel={t('auth.hidePassword')}
                  error={errors.password?.message ?? null}
                />
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label={t('auth.confirmNewPassword')}
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
                onSuccess: () => setTimeout(() => router.back(), 600),
              }),
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </SettingsPage>
  );
}
