import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { type SignInInput, SignInInputSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSignIn } from '../../src/features/auth/hooks';

export default function SignIn() {
  const { t } = useTranslation();
  const signIn = useSignIn();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(SignInInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: SignInInput) => {
    signIn.mutate(values, { onSuccess: () => router.replace('/') });
  };

  return (
    <Screen title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
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
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            error={errors.password?.message ?? null}
          />
        )}
      />

      {signIn.isError ? (
        <Text variant="body-s" style={{ color: '#F87171' }} accessibilityLiveRegion="polite">
          {t('auth.errors.invalidCredentials')}
        </Text>
      ) : null}

      <View style={{ alignItems: 'flex-end' }}>
        <Link href="/(auth)/reset-password">
          <Text variant="body-s" style={{ color: '#A1A1AA' }}>
            {t('auth.forgotPassword')}
          </Text>
        </Link>
      </View>

      <Button
        label={t('auth.signIn')}
        loading={signIn.isPending}
        onPress={handleSubmit(onSubmit)}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        <Text variant="body-m" style={{ color: '#A1A1AA' }}>
          {t('auth.noAccount')}
        </Text>
        <Link href="/(auth)/sign-up">
          <Text variant="body-m" style={{ color: '#F5F5F7', fontWeight: '600' }}>
            {t('auth.createAccount')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
