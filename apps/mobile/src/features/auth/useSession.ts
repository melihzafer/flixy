import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '../../lib/supabase';

export type AuthSession = {
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
};

const SESSION_KEY = ['auth', 'session'] as const;

function readAnonymousFlag(user: User | null): boolean {
  if (!user) return false;
  const meta = user.app_metadata as Record<string, unknown> | undefined;
  if (typeof user.is_anonymous === 'boolean') return user.is_anonymous;
  return Boolean(meta?.is_anonymous);
}

async function fetchSession(): Promise<AuthSession> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session ?? null;
  const user = session?.user ?? null;
  return { session, user, isAnonymous: readAnonymousFlag(user) };
}

/**
 * Reactive subscription to Supabase auth state.
 * Server state lives in TanStack Query; an onAuthStateChange listener pushes
 * updates straight into the cache so all consumers re-render together.
 */
export function useSession() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      qc.setQueryData<AuthSession>(SESSION_KEY, {
        session,
        user,
        isAnonymous: readAnonymousFlag(user),
      });
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [qc]);

  return query;
}

export const authQueryKeys = { session: SESSION_KEY };
