jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: jest.fn(),
      setSession: jest.fn(),
    },
  },
}));

import { logger } from '../../../lib/logger';
import { supabase } from '../../../lib/supabase';
import {
  classifyOAuthBrowserResult,
  completeOAuthCallbackUrl,
  parseOAuthCallbackUrl,
  resetOAuthCallbackDedupeForTests,
} from '../oauthCallback';

const authMock = supabase.auth as jest.Mocked<typeof supabase.auth>;
const loggerMock = logger as jest.Mocked<typeof logger>;

beforeEach(() => {
  jest.clearAllMocks();
  resetOAuthCallbackDedupeForTests();
});

describe('parseOAuthCallbackUrl', () => {
  it('parses PKCE code callbacks from the query string', () => {
    expect(parseOAuthCallbackUrl('flixy:///?code=auth-code&state=state-value')).toEqual({
      type: 'code',
      code: 'auth-code',
    });
  });

  it('parses implicit fragment token callbacks', () => {
    expect(
      parseOAuthCallbackUrl('flixy:///#access_token=access-token&refresh_token=refresh-token'),
    ).toEqual({
      type: 'tokens',
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('parses universal-link auth callbacks for production app links', () => {
    expect(parseOAuthCallbackUrl('https://flixy.app/?code=auth-code')).toEqual({
      type: 'code',
      code: 'auth-code',
    });
  });

  it('parses OAuth error callbacks', () => {
    expect(
      parseOAuthCallbackUrl('flixy:///?error=access_denied&error_description=User%20cancelled'),
    ).toEqual({
      type: 'error',
      error: 'access_denied',
      errorDescription: 'User cancelled',
    });
  });

  it('parses two-slash custom scheme redirect URLs correctly', () => {
    expect(parseOAuthCallbackUrl('flixy://auth/callback?code=auth-code')).toEqual({
      type: 'code',
      code: 'auth-code',
    });
    expect(
      parseOAuthCallbackUrl(
        'flixy://oauth/google#access_token=access-token&refresh_token=refresh-token',
      ),
    ).toEqual({
      type: 'tokens',
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('ignores non-auth URLs', () => {
    expect(parseOAuthCallbackUrl('flixy:///title/123')).toBeNull();
  });

  it('ignores foreign and non-callback app URLs even if they contain auth params', () => {
    expect(parseOAuthCallbackUrl('https://evil.example/?code=auth-code')).toBeNull();
    expect(parseOAuthCallbackUrl('flixy:///title/123?code=auth-code')).toBeNull();
    expect(parseOAuthCallbackUrl('not a url?code=auth-code')).toBeNull();
  });
});

describe('classifyOAuthBrowserResult', () => {
  it('classifies success callbacks without exposing the URL in logs', () => {
    expect(classifyOAuthBrowserResult({ type: 'success', url: 'flixy:///?code=abc' })).toEqual({
      kind: 'callback',
      resultType: 'success',
      url: 'flixy:///?code=abc',
    });
  });

  it('classifies cancel, dismiss, and missing callback URL states', () => {
    expect(classifyOAuthBrowserResult({ type: 'cancel' })).toEqual({
      kind: 'cancelled',
      resultType: 'cancel',
    });
    expect(classifyOAuthBrowserResult({ type: 'dismiss' })).toEqual({
      kind: 'dismissed',
      resultType: 'dismiss',
    });
    expect(classifyOAuthBrowserResult({ type: 'success' })).toEqual({
      kind: 'missing_callback_url',
      resultType: 'success',
    });
  });

  it('classifies browser edge states explicitly', () => {
    expect(classifyOAuthBrowserResult({ type: 'opened' })).toEqual({
      kind: 'opened',
      resultType: 'opened',
    });
    expect(classifyOAuthBrowserResult({ type: 'locked' })).toEqual({
      kind: 'locked',
      resultType: 'locked',
    });
    expect(classifyOAuthBrowserResult({ type: 'weird' })).toEqual({
      kind: 'unknown',
      resultType: 'weird',
    });
  });
});

describe('completeOAuthCallbackUrl', () => {
  it('exchanges PKCE codes for sessions', async () => {
    authMock.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);

    await expect(
      completeOAuthCallbackUrl('flixy:///?code=auth-code', 'web_browser'),
    ).resolves.toEqual({ handled: true, flow: 'pkce' });

    expect(authMock.exchangeCodeForSession).toHaveBeenCalledWith('auth-code');
    expect(loggerMock.info).toHaveBeenCalledWith(
      'auth.oauth_callback completed',
      expect.objectContaining({ source: 'web_browser', callbackType: 'code', flow: 'pkce' }),
    );
  });

  it('sets implicit fragment sessions', async () => {
    authMock.setSession.mockResolvedValue({ data: {}, error: null } as never);

    await expect(
      completeOAuthCallbackUrl(
        'flixy:///#access_token=access-token&refresh_token=refresh-token',
        'deep_link',
      ),
    ).resolves.toEqual({ handled: true, flow: 'fragment' });

    expect(authMock.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('rejects OAuth error callbacks and does not start a session', async () => {
    await expect(
      completeOAuthCallbackUrl(
        'flixy:///?error=access_denied&error_description=User%20cancelled',
        'web_browser',
      ),
    ).rejects.toThrow('Google sign-in was cancelled.');

    expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(authMock.setSession).not.toHaveBeenCalled();
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'auth.oauth_callback failed',
      expect.objectContaining({
        source: 'web_browser',
        callbackType: 'error',
        message: 'Google sign-in was cancelled.',
      }),
    );
  });

  it('ignores non-callback URLs without touching auth state', async () => {
    await expect(completeOAuthCallbackUrl('flixy:///title/123', 'deep_link')).resolves.toEqual({
      handled: false,
    });

    expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(authMock.setSession).not.toHaveBeenCalled();
  });

  it('dedupes repeated PKCE callback handling', async () => {
    authMock.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);

    await expect(
      Promise.all([
        completeOAuthCallbackUrl('flixy:///?code=auth-code', 'deep_link'),
        completeOAuthCallbackUrl('flixy:///?code=auth-code', 'web_browser'),
      ]),
    ).resolves.toEqual([
      { handled: true, flow: 'pkce' },
      { handled: true, flow: 'pkce' },
    ]);

    expect(authMock.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('dedupes repeated fragment callback handling without exposing tokens in logs', async () => {
    authMock.setSession.mockResolvedValue({ data: {}, error: null } as never);

    await expect(
      Promise.all([
        completeOAuthCallbackUrl(
          'flixy:///#access_token=access-token&refresh_token=refresh-token',
          'deep_link',
        ),
        completeOAuthCallbackUrl(
          'flixy:///#access_token=access-token&refresh_token=refresh-token',
          'web_browser',
        ),
      ]),
    ).resolves.toEqual([
      { handled: true, flow: 'fragment' },
      { handled: true, flow: 'fragment' },
    ]);

    expect(authMock.setSession).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        access_token: expect.any(String),
      }),
    );
  });
});
