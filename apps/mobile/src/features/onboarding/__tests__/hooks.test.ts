jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-a000-000000000001'),
}));

jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

import { __schemas } from '../hooks';

describe('onboarding preference schema', () => {
  it('accepts local-first user ids used by anonymous and email sessions', () => {
    const base = {
      selected_services: ['netflix'],
      selected_genres: ['action', 'drama', 'thriller'],
      notifications_enabled: false,
      onboarding_completed_at: null,
      cold_start_completed_at: null,
      updated_at: '2026-06-20T00:00:00.000Z',
    };

    expect(__schemas.PrefsRowSchema.parse({ user_id: 'anon', ...base }).user_id).toBe('anon');
    expect(__schemas.PrefsRowSchema.parse({ user_id: 'user-qa@flixy.app', ...base }).user_id).toBe(
      'user-qa@flixy.app',
    );
  });
});
