import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { type SignUpInput, SignUpInputSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSignUp } from '../../src/features/auth/hooks';

export default function SignUp() {
  const { t } = useTranslation();
  const signUp = useSignUp();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: SignUpInput) => {
    signUp.mutate(values, {
      onSuccess: (data) => {
        // If email confirmation is required, Supabase returns user but no
        // session; we keep the user on the success message instead of
        // redirecting into the app shell.
        if (data.session) {
          router.replace('/');
        }
      },
    });
  };

  return (
    <Screen title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
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
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.password?.message ?? null}
          />
        )}
      />

      {signUp.isError ? (
        <Text variant="body-s" style={{ color: '#F87171' }}>
          {t('auth.errors.generic')}
        </Text>
      ) : null}
      {signUp.isSuccess && !signUp.data?.session ? (
        <Text variant="body-s" style={{ color: '#10B981' }}>
          {t('auth.checkInbox')}
        </Text>
      ) : null}

      <Button
        label={t('auth.createAccount')}
        loading={signUp.isPending}
        onPress={handleSubmit(onSubmit)}
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
    </Screen>
  );
}
