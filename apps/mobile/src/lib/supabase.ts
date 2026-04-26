import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { secureStoreAdapter } from './secureStore';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const supabaseUrl = extra.supabaseUrl ?? '';
const supabaseAnonKey = extra.supabaseAnonKey ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Soft-warn during early bootstrap; production builds must have these set.
  console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL / ANON_KEY are not configured.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
