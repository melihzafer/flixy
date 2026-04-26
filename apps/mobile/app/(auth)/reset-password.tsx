import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type ResetPasswordInput, ResetPasswordInputSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useResetPassword } from '../../src/features/auth/hooks';

export default function ResetPassword() {
  const { t } = useTranslation();
  const reset = useResetPassword();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordInputSchema),
    defaultValues: { email: '' },
  });

  return (
    <Screen title={t('auth.resetPasswordTitle')} subtitle={t('auth.resetPasswordSubtitle')}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value, onBlur } }) => (
          <Input
            label={t('auth.email')}
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

      {reset.isSuccess ? (
        <Text variant="body-s" style={{ color: '#10B981' }} accessibilityLiveRegion="polite">
          {t('auth.resetPasswordSent')}
        </Text>
      ) : null}
      {reset.isError ? (
        <Text variant="body-s" style={{ color: '#F87171' }}>
          {t('auth.errors.generic')}
        </Text>
      ) : null}

      <Button
        label={t('auth.resetPasswordCta')}
        loading={reset.isPending}
        onPress={handleSubmit((v) => reset.mutate(v))}
      />
      <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
