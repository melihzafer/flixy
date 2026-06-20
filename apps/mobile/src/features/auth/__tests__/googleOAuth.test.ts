jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'nonce-1234'),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { googleOAuthClientId: 'cid', googleOAuthRedirectUri: 'flixy://x' } },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { exchangeCodeForSession: jest.fn(), setSession: jest.fn() } },
  isSupabaseConfigured: false,
}));

jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../useSession', () => ({
  setLocalSession: jest.fn(async () => undefined),
  authQueryKeys: { session: ['auth', 'session'] },
  useSession: () => ({ data: null }),
}));

import { __testing__buildGoogleAuthorizeUrl, __testing__parseGoogleCallback } from '../hooks';

describe('Google OAuth URL builder + callback parser', () => {
  it('builds a Google authorize URL with all required parameters', () => {
    const url = __testing__buildGoogleAuthorizeUrl(
      { clientId: 'test-client-id', redirectUri: 'flixy://oauth/google' },
      'nonce-123',
    );
    const parsed = new URL(url);
    expect(parsed.host).toBe('accounts.google.com');
    expect(parsed.pathname).toBe('/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe('flixy://oauth/google');
    expect(parsed.searchParams.get('response_type')).toBe('token id_token');
    expect(parsed.searchParams.get('scope')).toBe('openid email profile');
    expect(parsed.searchParams.get('nonce')).toBe('nonce-123');
  });

  it('parses an email from a fragment-style callback', () => {
    const callback = __testing__parseGoogleCallback(
      'flixy://oauth/google#email=alice%40example.com&access_token=abc&nonce=nonce-123',
    );
    expect(callback?.email).toBe('alice@example.com');
    expect(callback?.nonce).toBe('nonce-123');
  });

  it('parses an email from a query-style callback', () => {
    const callback = __testing__parseGoogleCallback(
      'flixy://oauth/google?email=bob%40example.com&nonce=nonce-456',
    );
    expect(callback?.email).toBe('bob@example.com');
    expect(callback?.nonce).toBe('nonce-456');
  });

  it('returns null for callbacks without an email', () => {
    expect(__testing__parseGoogleCallback('flixy://oauth/google#access_token=abc')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(__testing__parseGoogleCallback('not a url')).toBeNull();
  });
});
