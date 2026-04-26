import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import type {
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
  UpdatePasswordInput,
} from '@flixy/shared';

import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';
import { authQueryKeys } from './useSession';

/**
 * Auth mutation hooks. Each one wraps a Supabase call, surfaces errors
 * verbatim (callers translate via i18n), and invalidates the session cache
 * on success so `useSession` re-fetches.
 */

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authQueryKeys.session }),
    onError: (e) => logger.warn('auth.signUp failed', { message: (e as Error).message }),
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignInInput) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authQueryKeys.session }),
    onError: (e) => logger.warn('auth.signIn failed', { message: (e as Error).message }),
  });
}

/**
 * Anonymous sign-in: lets a user start swiping immediately. After ~15 swipes
 * (FSD § 3.1) we surface an upgrade prompt to convert to a real account.
 */
export function useAnonymousSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authQueryKeys.session }),
    onError: (e) => logger.warn('auth.anon failed', { message: (e as Error).message }),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authQueryKeys.session }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const redirectTo = Linking.createURL('/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(input.email, { redirectTo });
      if (error) throw error;
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (input: UpdatePasswordInput) => {
      const { error } = await supabase.auth.updateUser({ password: input.password });
      if (error) throw error;
    },
  });
}

/**
 * Upgrade an anonymous account to a full credentialed account.
 * Supabase exposes this via `updateUser({ email, password })` on an anon user.
 */
export function useUpgradeAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const { error } = await supabase.auth.updateUser({
        email: input.email,
        password: input.password,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authQueryKeys.session }),
  });
}
