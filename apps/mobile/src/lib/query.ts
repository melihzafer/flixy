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
  key: 'flixy.query-cache.v2',
  throttleTime: 1000,
});
