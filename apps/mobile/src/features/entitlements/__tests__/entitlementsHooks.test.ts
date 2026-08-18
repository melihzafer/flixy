/**
 * Regression tests for offline entitlement handling.
 *
 * Before the fix, `useEntitlements` returned SAFE_FREE_SNAPSHOT on ANY load
 * error, so an offline refetch replaced the last known plan in the react-query
 * cache — and the 7-day persisted copy — with free. A paying user opening the
 * app without connectivity was demoted to free client-side (deck quotas, blind
 * date, advanced filters) until the next successful fetch.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-a000-000000000001'),
}));

jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() },
  },
}));

jest.mock('../../auth/useSession', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' }, isAnonymous: false } }),
}));

jest.mock('../../telemetry/events', () => ({
  events: {
    entitlementsLoaded: jest.fn(),
    discoverySessionStartRequested: jest.fn(),
    discoverySessionStarted: jest.fn(),
    discoverySessionQuotaExceeded: jest.fn(),
  },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { supabase } from '../../../lib/supabase';
import { FREE_ENTITLEMENTS, SAFE_FREE_SNAPSHOT } from '../constants';
import { useEntitlements, useStartDiscoverySession } from '../hooks';

const GOLD_SNAPSHOT = {
  plan_id: 'gold' as const,
  entitlements: { ...FREE_ENTITLEMENTS, unlimited_discovery: true, advanced_filters: true },
};

const rpcMock = supabase.rpc as jest.Mock;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderHookWithRenderer<T>(hook: () => T, client: QueryClient) {
  const result = { current: undefined as T };
  let renderer!: ReactTestRenderer;

  function TestComponent() {
    result.current = hook();
    return null;
  }

  act(() => {
    renderer = create(createElement(QueryClientProvider, { client }, createElement(TestComponent)));
  });

  return {
    result,
    unmount: () => {
      act(() => renderer.unmount());
    },
  };
}

async function waitForCondition(assertion: () => void, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  do {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  } while (Date.now() < deadline);

  throw lastError;
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 5 * 60_000, gcTime: Number.POSITIVE_INFINITY },
    },
  });
}

beforeEach(() => {
  rpcMock.mockReset();
});

describe('useEntitlements offline resilience', () => {
  it('keeps the last known plan when the RPC fails and a snapshot is cached', async () => {
    rpcMock.mockRejectedValue(new Error('offline'));
    const client = makeClient();
    // Seed the cache as if a previous load succeeded; updatedAt: 0 forces the
    // stale query to refetch on mount (simulating a cold start offline).
    client.setQueryData(['entitlements', 'user-1'], GOLD_SNAPSHOT, { updatedAt: 0 });

    const { result, unmount } = renderHookWithRenderer(() => useEntitlements(), client);

    try {
      await waitForCondition(() => expect(rpcMock).toHaveBeenCalledTimes(1));
      await waitForCondition(() => expect(result.current.isError).toBe(true));

      // The paid plan survives both the query result and the cache.
      expect(result.current.data).toEqual(GOLD_SNAPSHOT);
      expect(client.getQueryData(['entitlements', 'user-1'])).toEqual(GOLD_SNAPSHOT);
    } finally {
      unmount();
    }
  });

  it('falls back to the free snapshot only when nothing has ever loaded', async () => {
    rpcMock.mockRejectedValue(new Error('offline'));
    const client = makeClient();

    const { result, unmount } = renderHookWithRenderer(() => useEntitlements(), client);

    try {
      await waitForCondition(() => expect(rpcMock).toHaveBeenCalledTimes(1));
      await waitForCondition(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(SAFE_FREE_SNAPSHOT);
    } finally {
      unmount();
    }
  });

  it('starts a local session when an authenticated session RPC is offline', async () => {
    rpcMock.mockRejectedValue(new Error('offline'));
    const client = makeClient();
    const { result, unmount } = renderHookWithRenderer(() => useStartDiscoverySession(), client);

    try {
      let session: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
      await act(async () => {
        session = await result.current.mutateAsync({ mode: 'main_deck', requestedCards: 12 });
      });

      expect(session).toMatchObject({
        allowed: true,
        offline: true,
        cards_limit: 12,
        remaining_sessions: null,
      });
      if (session?.allowed) {
        expect(session.session_id).toBe('00000000-0000-4000-a000-000000000001');
      }
    } finally {
      unmount();
    }
  });
});
