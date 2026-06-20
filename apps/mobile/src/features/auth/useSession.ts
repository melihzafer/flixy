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

const EMPTY_SESSION: AuthSession = {
  session: null,
  user: null,
  isAnonymous: false,
};

let currentSession: AuthSession = EMPTY_SESSION;

const listeners = new Set<(session: AuthSession) => void>();

export function subscribeToSession(callback: (session: AuthSession) => void) {
  listeners.add(callback);
  callback(currentSession);
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
      return currentSession;
    }
    throw error;
  }
  currentSession = sessionFromSupabase(data.session);
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
  return currentSession;
}

export function getSessionSnapshot(): Promise<AuthSession> {
  return isSupabaseConfigured ? getSupabaseSession() : getLocalSession();
}

export async function setLocalSession(session: AuthSession) {
  currentSession = session;
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
