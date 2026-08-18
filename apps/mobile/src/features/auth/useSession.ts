import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { logger } from '../../lib/logger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { isReadOnlyRefreshTokenError } from './authErrors';

export type AuthSession = {
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
};

const SESSION_KEY = ['auth', 'session'] as const;
const SESSION_STORAGE_KEY = 'flixy.local_session.v2';
const SESSION_READ_TIMEOUT_MS = 8_000;

const EMPTY_SESSION: AuthSession = {
  session: null,
  user: null,
  isAnonymous: false,
};

let currentSession: AuthSession = EMPTY_SESSION;

/**
 * Whether the persisted local session has been read from storage at least
 * once. Until then `currentSession` is a placeholder EMPTY_SESSION that must
 * never be replayed to subscribers: writing it into the query cache would flip
 * `useSession().isLoading` to false with a null session while the real session
 * is still loading, flashing the auth screen before the home redirect.
 */
let isSessionHydrated = false;

const listeners = new Set<(session: AuthSession) => void>();

export function subscribeToSession(callback: (session: AuthSession) => void) {
  listeners.add(callback);
  if (isSessionHydrated) callback(currentSession);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentSession);
  }
}

function isAnonymousUser(user: User | null) {
  if (!user) return false;
  return Boolean(
    (user as User & { is_anonymous?: boolean }).is_anonymous ?? user.app_metadata?.is_anonymous,
  );
}

function sessionFromSupabase(session: Session | null): AuthSession {
  const user = session?.user ?? null;
  return {
    session,
    user,
    isAnonymous: isAnonymousUser(user),
  };
}

async function getSupabaseSession(): Promise<AuthSession> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (isReadOnlyRefreshTokenError(error)) {
      logger.warn('auth.session refresh failed; clearing stale session', {
        message: error.message,
      });
      await supabase.auth.signOut();
      currentSession = EMPTY_SESSION;
      isSessionHydrated = true;
      return currentSession;
    }
    throw error;
  }
  currentSession = sessionFromSupabase(data.session);
  isSessionHydrated = true;
  return currentSession;
}

export async function getLocalSession(): Promise<AuthSession> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      currentSession = JSON.parse(raw);
    }
  } catch (e) {
    logger.warn('auth.local_session load failed', { message: (e as Error).message });
  }
  isSessionHydrated = true;
  return currentSession;
}

export function getSessionSnapshot(): Promise<AuthSession> {
  if (!isSupabaseConfigured) return getLocalSession();

  const sessionPromise = getSupabaseSession();
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      currentSession = EMPTY_SESSION;
      isSessionHydrated = true;
      logger.warn('auth.session read timed out; continuing as guest');
      resolve(currentSession);
    }, SESSION_READ_TIMEOUT_MS);

    void sessionPromise.then(
      (session) => {
        clearTimeout(timeoutId);
        if (settled) {
          currentSession = session;
          notifyListeners();
          return;
        }
        settled = true;
        resolve(session);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        if (settled) return;
        settled = true;
        logger.warn('auth.session read failed; continuing as guest', {
          message: error instanceof Error ? error.message : String(error),
        });
        currentSession = EMPTY_SESSION;
        isSessionHydrated = true;
        resolve(currentSession);
      },
    );
  });
}

export async function setLocalSession(session: AuthSession) {
  currentSession = session;
  isSessionHydrated = true;
  notifyListeners();
  try {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    logger.warn('auth.local_session save failed', { message: (e as Error).message });
  }
}

export function useSession() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: getSessionSnapshot,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const next = sessionFromSupabase(session);
        currentSession = next;
        notifyListeners();
        qc.setQueryData<AuthSession>(SESSION_KEY, next);
      });
      return () => data.subscription.unsubscribe();
    }

    return subscribeToSession((session) => {
      qc.setQueryData<AuthSession>(SESSION_KEY, session);
    });
  }, [qc]);

  return query;
}

export const authQueryKeys = { session: SESSION_KEY };
