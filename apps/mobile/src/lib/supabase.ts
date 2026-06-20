import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { secureStoreAdapter } from './secureStore';

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra;
const supabaseUrl = extra.supabaseUrl?.trim() ?? '';
const supabaseAnonKey = extra.supabaseAnonKey?.trim() ?? '';

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

function disabledClient(): SupabaseClient {
  const disabled = new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => {
        throw disabled;
      },
      signInWithPassword: async () => {
        throw disabled;
      },
      signInAnonymously: async () => {
        throw disabled;
      },
      signOut: async () => ({ error: null }),
      signInWithOAuth: async () => {
        throw disabled;
      },
      exchangeCodeForSession: async () => {
        throw disabled;
      },
      setSession: async () => {
        throw disabled;
      },
      resetPasswordForEmail: async () => {
        throw disabled;
      },
      updateUser: async () => {
        throw disabled;
      },
    },
    from: () => {
      throw disabled;
    },
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: secureStoreAdapter,
      },
    })
  : disabledClient();
