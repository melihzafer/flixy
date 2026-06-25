import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type {
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
  UpdatePasswordInput,
} from '@flixy/shared';

import { CREDENTIALS_KEY, localDb } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAnonSwipeStore } from '../../stores/anonSwipe';
import { classifyOAuthBrowserResult, completeOAuthCallbackUrl } from './oauthCallback';
import { authQueryKeys, setLocalSession, useSession } from './useSession';

type GoogleOAuthConfig = {
  clientId: string;
  redirectUri: string;
};

type SupabaseOAuthExtra = {
  supabaseOAuthRedirectUri?: string;
};

function readGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Partial<GoogleOAuthConfig> & {
    googleOAuthClientId?: string;
    googleOAuthRedirectUri?: string;
  };
  const clientId = extra.googleOAuthClientId?.trim();
  if (!clientId) return null;

  let redirectUri = extra.googleOAuthRedirectUri?.trim();
  if (!redirectUri) {
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (isWeb) {
      redirectUri = Linking.createURL('auth/callback');
    } else {
      redirectUri = 'flixy://oauth/google';
    }
  }
  return { clientId, redirectUri };
}

function readSupabaseOAuthRedirectUri(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as SupabaseOAuthExtra;
  let uri = extra.supabaseOAuthRedirectUri?.trim();
  if (typeof __DEV__ !== 'undefined' && __DEV__ && uri === 'flixy:///auth/callback') {
    uri = undefined;
  }
  if (uri) {
    logger.info('Using configured OAuth redirect URI', { uri });
    return uri;
  }
  const resolved = Linking.createURL('auth/callback');
  logger.info('Using dynamic OAuth redirect URI', { resolved });
  return resolved;
}

function generateNonce(): string {
  // Random nonce so the implicit-flow state we put in localStorage can't be
  // replayed; not cryptographically tied to a server, but enough to
  // distinguish this launch from a previous one for the same device.
  return Crypto.randomUUID();
}

function buildGoogleAuthorizeUrl(config: GoogleOAuthConfig, nonce: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'token id_token',
    scope: 'openid email profile',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    nonce,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function __testing__parseGoogleCallback(
  url: string,
): { email: string; nonce: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hash && !parsed.search) return null;
    const source = parsed.hash ? parsed.hash.slice(1) : parsed.search.slice(1);
    const params = new URLSearchParams(source);
    const email = params.get('email');
    if (!email) return null;
    return { email, nonce: params.get('nonce') ?? '' };
  } catch {
    return null;
  }
}

export function __testing__buildGoogleAuthorizeUrl(
  config: GoogleOAuthConfig,
  nonce: string,
): string {
  return buildGoogleAuthorizeUrl(config, nonce);
}

const ANON_USER_ID = 'anon';
const ANON_EMAIL = 'anonymous@flixy.app';

type OAuthSignInResult =
  | {
      provider: 'google';
      status: 'completed';
      handledBy: 'web_browser' | 'deep_link';
      flow: 'pkce' | 'fragment' | 'session';
    }
  | { provider: 'google'; status: 'cancelled' | 'dismissed' };

function userIdForEmail(email: string): string {
  return `user-${email.trim().toLowerCase()}`;
}

function createMockUser(id: string, email: string, isAnonymous = false): User {
  return {
    id,
    email: isAnonymous ? ANON_EMAIL : email,
    app_metadata: { is_anonymous: isAnonymous, provider: isAnonymous ? 'anonymous' : 'email' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    is_anonymous: isAnonymous,
  } as unknown as User;
}

function createMockSession(user: User): Session {
  return {
    access_token: `mock-access-token-${Date.now()}`,
    refresh_token: `mock-refresh-token-${Date.now()}`,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const email = input.email.trim().toLowerCase();
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({ email, password: input.password });
        if (error) throw error;
        return { session: data.session, user: data.user };
      }

      const existing = await localDb.getCredential(email);
      if (existing) {
        throw new Error('An account with this email already exists.');
      }
      const userId = userIdForEmail(email);
      await localDb.saveCredential(email, input.password, userId);

      const user = createMockUser(userId, email);
      const session = createMockSession(user);
      await setLocalSession({ session, user, isAnonymous: false });
      return { session, user };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authQueryKeys.session }),
    onError: (e) => logger.warn('auth.signUp failed', { message: (e as Error).message }),
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignInInput) => {
      const email = input.email.trim().toLowerCase();
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: input.password,
        });
        if (error) throw error;
        return { session: data.session, user: data.user };
      }

      const cred = await localDb.getCredential(email);
      if (!cred) {
        throw new Error('No account found with this email.');
      }
      if (cred.passwordHash !== input.password) {
        throw new Error('Incorrect password.');
      }

      // Reuse the existing user_id so watchlist / prefs / profile survive
      // the sign-out → sign-in round trip on the same device.
      const userId = cred.userId || userIdForEmail(email);
      const user = createMockUser(userId, email);
      const session = createMockSession(user);
      await setLocalSession({ session, user, isAnonymous: false });
      return { session, user };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authQueryKeys.session }),
    onError: (e) => logger.warn('auth.signIn failed', { message: (e as Error).message }),
  });
}

export function useAnonymousSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return { session: data.session, user: data.user };
      }

      // All anonymous sessions on the same device share the same user_id so
      // re-entering "Just browse" returns the same on-device data.
      const user = createMockUser(ANON_USER_ID, ANON_EMAIL, true);
      const session = createMockSession(user);
      await setLocalSession({ session, user, isAnonymous: true });
      return { session, user };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authQueryKeys.session });
    },
    onError: (e) => logger.warn('auth.anon failed', { message: (e as Error).message }),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return;
      }

      // Keep on-device data so the same email can sign back in and pick up
      // where they left off. The session is the only thing that goes.
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return;
      }
      await setLocalSession({ session: null, user: null, isAnonymous: false });
    },
    onSuccess: () => {
      useAnonSwipeStore.getState().reset();
      // Drop in-memory query state for the previous user; the persisted
      // cache (AsyncStorage) is re-hydrated on the next session.
      qc.clear();
    },
  });
}

/**
 * Explicit, destructive: wipe all local data for the current user. Use for
 * a "Delete account" action, not for sign out.
 */
export function useDeleteLocalAccount() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    mutationFn: async () => {
      const userId = session?.user?.id;
      const email = session?.user?.email;
      if (userId) {
        await localDb.clearUser(userId);
        await localDb.clearUserMemory();
      }
      if (email && !session?.isAnonymous) {
        const normalized = email.toLowerCase();
        if (normalized) {
          const cred = await localDb.getCredential(normalized);
          if (cred) {
            // Drop the credential too so the email can never sign in again
            // on this device.
            await AsyncStorage.removeItem(CREDENTIALS_KEY);
          }
        }
      }
      await setLocalSession({ session: null, user: null, isAnonymous: false });
    },
    onSuccess: () => {
      useAnonSwipeStore.getState().reset();
      qc.clear();
    },
  });
}

export function useOAuthSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: 'google'): Promise<OAuthSignInResult> => {
      if (isSupabaseConfigured) {
        return completeSupabaseOAuthFlow(provider);
      }

      const config = readGoogleOAuthConfig();
      if (!config) {
        // No Google OAuth client_id configured — fall back to the device
        // mock so the button is still tappable in dev. This keeps the
        // sign-in surface usable without forcing a Google Cloud setup.
        return completeGoogleMockSignIn();
      }
      return completeGoogleWebBrowserFlow(config);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authQueryKeys.session });
    },
    onError: (e) => logger.warn('auth.googleOAuth failed', { message: (e as Error).message }),
  });
}

async function completeSupabaseOAuthFlow(provider: 'google'): Promise<OAuthSignInResult> {
  const redirectTo = readSupabaseOAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in could not be started.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  const classification = classifyOAuthBrowserResult(result);

  if (classification.kind === 'callback') {
    const callback = await completeOAuthCallbackUrl(classification.url, 'web_browser');
    if (callback.handled) {
      return {
        provider,
        status: 'completed',
        handledBy: 'web_browser',
        flow: callback.flow ?? 'pkce',
      };
    }
  }

  if (classification.kind === 'cancelled') return { provider, status: 'cancelled' };
  return { provider, status: 'dismissed' };
}

async function completeGoogleMockSignIn(): Promise<OAuthSignInResult> {
  const email = 'google-user@gmail.com';
  const userId = userIdForEmail(email);
  const existing = await localDb.getCredential(email);
  if (!existing) {
    await localDb.saveCredential(email, 'oauth-sign-in-no-password', userId);
  }
  const user = createMockUser(userId, email);
  const session = createMockSession(user);
  await setLocalSession({ session, user, isAnonymous: false });
  return {
    provider: 'google',
    status: 'completed',
    handledBy: 'web_browser',
    flow: 'session',
  };
}

async function completeGoogleWebBrowserFlow(config: GoogleOAuthConfig): Promise<OAuthSignInResult> {
  const nonce = generateNonce();
  const authUrl = buildGoogleAuthorizeUrl(config, nonce);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, config.redirectUri);

  if (result.type !== 'success' || !result.url) {
    return { provider: 'google', status: 'cancelled' };
  }

  const callback = __testing__parseGoogleCallback(result.url);
  if (!callback?.email) {
    throw new Error('Google sign-in did not return an email address.');
  }

  const { email } = callback;
  const userId = userIdForEmail(email);
  const existing = await localDb.getCredential(email);
  if (!existing) {
    await localDb.saveCredential(email, 'oauth-sign-in-no-password', userId);
  }
  const user = createMockUser(userId, email);
  const session = createMockSession(user);
  await setLocalSession({ session, user, isAnonymous: false });

  return {
    provider: 'google',
    status: 'completed',
    handledBy: 'web_browser',
    flow: 'fragment',
  };
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const email = input.email.trim().toLowerCase();
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: readSupabaseOAuthRedirectUri(),
        });
        if (error) throw error;
        return;
      }

      const existing = await localDb.getCredential(email);
      if (!existing) {
        throw new Error('No account found with this email.');
      }
      // Carry the existing user_id so prefs/watchlist keep their owner.
      await localDb.saveCredential(email, input.password, existing.userId);
    },
    onError: (e) => logger.warn('auth.resetPassword failed', { message: (e as Error).message }),
  });
}

export function useUpdatePassword() {
  const { data: session } = useSession();
  return useMutation({
    mutationFn: async (input: UpdatePasswordInput) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({ password: input.password });
        if (error) throw error;
        return;
      }

      const email = session?.user?.email;
      if (!email) throw new Error('Not authenticated.');
      const existing = await localDb.getCredential(email);
      const userId = existing?.userId ?? userIdForEmail(email);
      await localDb.saveCredential(email, input.password, userId);
    },
  });
}

export function useUpgradeAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const email = input.email.trim().toLowerCase();
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({
          email,
          password: input.password,
        });
        if (error) throw error;
        return;
      }

      const existing = await localDb.getCredential(email);
      if (existing) {
        throw new Error('An account with this email already exists.');
      }
      const userId = userIdForEmail(email);
      await localDb.saveCredential(email, input.password, userId);

      const user = createMockUser(userId, email);
      const session = createMockSession(user);
      await setLocalSession({ session, user, isAnonymous: false });
    },
    onSuccess: () => {
      useAnonSwipeStore.getState().reset();
      qc.clear();
    },
  });
}
