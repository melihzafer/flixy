import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { shouldRetryQuery } from './networkPolicy';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    // Retrying writes globally is unsafe: a timed-out request may have
    // succeeded remotely. Individual idempotent mutations can opt in.
    mutations: { retry: false },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // v3: cache blobs written before the deck-freshness fix contain persisted
  // ['titles','query'] discover pages. shouldDehydrateQuery only filters
  // future WRITES — an old blob would still restore its stale deck once.
  // Bumping the key orphans those blobs entirely.
  key: 'flixy.query-cache.v3',
  throttleTime: 1000,
});
