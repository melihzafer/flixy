import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';

type OAuthCallbackSource = 'deep_link' | 'web_browser';
type OAuthBrowserResult = { type: string; url?: string };

type OAuthCallback =
  | { type: 'code'; code: string }
  | { type: 'tokens'; access_token: string; refresh_token: string }
  | { type: 'error'; error: string; errorDescription: string | null };

type OAuthCallbackResult = {
  handled: boolean;
  flow?: 'pkce' | 'fragment';
};

type OAuthBrowserResultClassification =
  | { kind: 'callback'; resultType: 'success'; url: string }
  | { kind: 'missing_callback_url'; resultType: 'success' }
  | { kind: 'cancelled'; resultType: 'cancel' }
  | { kind: 'dismissed'; resultType: 'dismiss' }
  | { kind: 'opened'; resultType: 'opened' }
  | { kind: 'locked'; resultType: 'locked' }
  | { kind: 'unknown'; resultType: string };

const OAUTH_CALLBACK_SCHEME = 'flixy';
const OAUTH_UNIVERSAL_LINK_HOST = 'flixy.app';
const OAUTH_CALLBACK_PATHS = new Set(['', '/', '/auth/callback', '/oauth/google']);
const pendingCallbackCompletions = new Map<string, Promise<OAuthCallbackResult>>();
const CALLBACK_DEDUPE_MS = 15_000;

function rememberCompletedCallback(key: string) {
  const timeout = setTimeout(() => pendingCallbackCompletions.delete(key), CALLBACK_DEDUPE_MS);
  const maybeNodeTimeout = timeout as { unref?: () => void };
  if (typeof maybeNodeTimeout.unref === 'function') maybeNodeTimeout.unref();
}

function isAllowedOAuthCallbackUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === `${OAUTH_CALLBACK_SCHEME}:`) {
      const fullPath = (parsed.hostname + parsed.pathname).replace(/\/+/g, '/');
      const cleanPath = fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
      return OAUTH_CALLBACK_PATHS.has(cleanPath);
    }
    if (parsed.protocol === 'https:') {
      const path = parsed.pathname || '';
      return parsed.hostname === OAUTH_UNIVERSAL_LINK_HOST && OAUTH_CALLBACK_PATHS.has(path);
    }
    if (
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      (parsed.protocol === 'exp:' || parsed.protocol === 'expo:')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function getCallbackParams(url: string) {
  const hashIndex = url.indexOf('#');
  const queryEnd = hashIndex === -1 ? url.length : hashIndex;
  const queryIndex = url.indexOf('?');
  const query =
    queryIndex === -1 || queryIndex > queryEnd ? '' : url.slice(queryIndex + 1, queryEnd);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1);

  return {
    queryParams: new URLSearchParams(query),
    hashParams: new URLSearchParams(hash),
  };
}

function hashSensitiveValue(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
  }
  return `${value.length}:${(hash >>> 0).toString(36)}`;
}

function getCallbackDedupeKey(callback: OAuthCallback) {
  if (callback.type === 'code') return `code:${hashSensitiveValue(callback.code)}`;
  if (callback.type === 'tokens') {
    return `tokens:${hashSensitiveValue(`${callback.access_token}:${callback.refresh_token}`)}`;
  }
  return null;
}

function getOAuthCallbackErrorMessage(callback: Extract<OAuthCallback, { type: 'error' }>) {
  if (callback.error === 'access_denied') return 'Google sign-in was cancelled.';
  return 'Google sign-in could not be completed.';
}

function sanitizeOAuthErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (
    /(?:access_token|refresh_token|code=|id_token|email|https?:\/\/|flixy:\/\/|@)/i.test(message)
  ) {
    return 'Google sign-in could not be completed.';
  }
  return message;
}

export function parseOAuthCallbackUrl(url: string): OAuthCallback | null {
  if (!isAllowedOAuthCallbackUrl(url)) return null;

  const { queryParams, hashParams } = getCallbackParams(url);
  const error = queryParams.get('error') ?? hashParams.get('error');
  if (error) {
    return {
      type: 'error',
      error,
      errorDescription: queryParams.get('error_description') ?? hashParams.get('error_description'),
    };
  }

  const code = queryParams.get('code');
  if (code) return { type: 'code', code };

  const access_token = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');
  if (access_token && refresh_token) return { type: 'tokens', access_token, refresh_token };

  return null;
}

export function classifyOAuthBrowserResult(
  result: OAuthBrowserResult,
): OAuthBrowserResultClassification {
  if (result.type === 'success') {
    return result.url
      ? { kind: 'callback', resultType: 'success', url: result.url }
      : { kind: 'missing_callback_url', resultType: 'success' };
  }
  if (result.type === 'cancel') return { kind: 'cancelled', resultType: 'cancel' };
  if (result.type === 'dismiss') return { kind: 'dismissed', resultType: 'dismiss' };
  if (result.type === 'opened') return { kind: 'opened', resultType: 'opened' };
  if (result.type === 'locked') return { kind: 'locked', resultType: 'locked' };
  return { kind: 'unknown', resultType: result.type };
}

export function resetOAuthCallbackDedupeForTests() {
  pendingCallbackCompletions.clear();
}

export async function completeOAuthCallbackUrl(
  url: string,
  source: OAuthCallbackSource,
): Promise<OAuthCallbackResult> {
  const startedAt = Date.now();
  const callback = parseOAuthCallbackUrl(url);
  if (!callback) {
    logger.debug('auth.oauth_callback ignored', { source });
    return { handled: false };
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    let redirectHost = '';
    try {
      redirectHost = new URL(url).host || new URL(url).protocol;
    } catch {
      redirectHost = 'unparseable';
    }
    logger.debug('auth.oauth_callback start', {
      callbackSource: source,
      redirectHost,
      callbackType: callback.type,
      startedAt,
    });
  }

  const dedupeKey = getCallbackDedupeKey(callback);
  if (dedupeKey) {
    const existing = pendingCallbackCompletions.get(dedupeKey);
    if (existing) {
      logger.info('auth.oauth_callback duplicate', { source, callbackType: callback.type });
      return existing;
    }
  }

  const completion: Promise<OAuthCallbackResult> = (async () => {
    if (callback.type === 'error') {
      throw new Error(getOAuthCallbackErrorMessage(callback));
    }

    if (callback.type === 'code') {
      const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
      if (error) throw error;
      return { handled: true, flow: 'pkce' };
    }

    const { error } = await supabase.auth.setSession({
      access_token: callback.access_token,
      refresh_token: callback.refresh_token,
    });
    if (error) throw error;
    return { handled: true, flow: 'fragment' };
  })();

  if (dedupeKey) pendingCallbackCompletions.set(dedupeKey, completion);

  try {
    const result = await completion;
    logger.info('auth.oauth_callback completed', {
      source,
      callbackType: callback.type,
      flow: result.flow,
      durationMs: Date.now() - startedAt,
    });
    if (dedupeKey) rememberCompletedCallback(dedupeKey);
    return result;
  } catch (err) {
    if (dedupeKey) pendingCallbackCompletions.delete(dedupeKey);
    logger.warn('auth.oauth_callback failed', {
      source,
      callbackType: callback.type,
      message: sanitizeOAuthErrorMessage(err),
    });
    throw err;
  }
}
