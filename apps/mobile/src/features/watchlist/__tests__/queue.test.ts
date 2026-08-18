const storage = new Map<string, string>();
const getItem = jest.fn(async (key: string) => storage.get(key) ?? null);
const setItem = jest.fn(async (key: string, value: string) => {
  storage.set(key, value);
});
const from = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem, setItem },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-a000-000000000099'),
}));

jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from },
}));

import {
  WATCHLIST_QUEUE_STORAGE_KEY,
  createWatchlistQueueOperation,
  useWatchlistQueue,
} from '../queue';

const item = {
  user_id: '00000000-0000-4000-a000-000000000123',
  title_id: '00000000-0000-4000-b000-000000014052',
  priority: 'normal' as const,
  position: 0,
  added_at: '2026-06-20T00:00:00.000Z',
  watched_at: null,
  removed_at: null,
};

beforeEach(() => {
  storage.clear();
  jest.clearAllMocks();
  useWatchlistQueue.setState({ pending: [], inFlight: false, lastError: null });
});

describe('watchlist outbox', () => {
  it('persists and replays an offline upsert after reconnect', async () => {
    const single = jest.fn(async () => ({
      data: { id: 'server-row', ...item },
      error: null,
    }));
    const select = jest.fn(() => ({ single }));
    const upsert = jest.fn(() => ({ select }));
    from.mockReturnValue({ upsert });

    await useWatchlistQueue.getState().enqueue({
      ...createWatchlistQueueOperation({ type: 'upsert', item }),
    });

    expect(storage.get(WATCHLIST_QUEUE_STORAGE_KEY)).toContain('title_id');
    expect(useWatchlistQueue.getState().pending).toHaveLength(1);

    await useWatchlistQueue.getState().flush();

    expect(upsert).toHaveBeenCalledWith(item, { onConflict: 'user_id,title_id' });
    expect(useWatchlistQueue.getState().pending).toEqual([]);
    expect(storage.get(WATCHLIST_QUEUE_STORAGE_KEY)).toBe('[]');
  });

  it('drops malformed persisted operations but keeps valid ones', async () => {
    const operation = createWatchlistQueueOperation({ type: 'upsert', item });
    storage.set(
      WATCHLIST_QUEUE_STORAGE_KEY,
      JSON.stringify([operation, { type: 'not-a-watchlist-operation' }]),
    );

    await useWatchlistQueue.getState().hydrate();

    expect(useWatchlistQueue.getState().pending).toEqual([operation]);
    expect(JSON.parse(storage.get(WATCHLIST_QUEUE_STORAGE_KEY) ?? 'null')).toEqual([operation]);
  });
});
