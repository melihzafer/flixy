jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-a000-000000000001'),
}));

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  init: jest.fn(),
}));

jest.mock('../../../lib/analytics', () => ({ posthog: null, track: jest.fn() }));
jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../../lib/supabase';
import { __schemas } from '../hooks';
import { watchlistStore } from '../store';

const fromMock = supabase.from as jest.Mock;

const row = {
  id: 'local-item-1',
  user_id: '00000000-0000-4000-a000-000000000123',
  title_id: '00000000-0000-4000-b000-000000014052',
  priority: 'normal',
  position: 0,
  added_at: '2026-06-20T00:00:00.000Z',
  watched_at: null,
  removed_at: null,
} as const;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('watchlist schemas', () => {
  it('accepts local-first IDs from anonymous sessions and TMDB titles', () => {
    const parsed = __schemas.RowSchema.parse({
      id: 'local-item-1',
      user_id: 'anon',
      title_id: '00000000-0000-4000-b000-000000014052',
      priority: 'normal',
      position: 0,
      added_at: '2026-06-20T00:00:00.000Z',
      watched_at: null,
      removed_at: null,
    });

    expect(parsed.user_id).toBe('anon');
    expect(parsed.id).toBe('local-item-1');
  });

  it('reads active rows from Supabase without joining title metadata', async () => {
    const isMock = jest.fn(async () => ({ data: [row], error: null }));
    const eqMock = jest.fn(() => ({ is: isMock }));
    const selectMock = jest.fn(() => ({ eq: eqMock }));
    fromMock.mockReturnValue({ select: selectMock });

    await expect(watchlistStore.getWatchlist(row.user_id)).resolves.toEqual([row]);

    expect(fromMock).toHaveBeenCalledWith('watchlist_items');
    expect(selectMock).toHaveBeenCalledWith(
      'id,user_id,title_id,priority,position,added_at,watched_at,removed_at',
    );
    expect(eqMock).toHaveBeenCalledWith('user_id', row.user_id);
    expect(isMock).toHaveBeenCalledWith('removed_at', null);
  });

  it('upserts only the watchlist row into Supabase', async () => {
    const singleMock = jest.fn(async () => ({ data: row, error: null }));
    const selectMock = jest.fn(() => ({ single: singleMock }));
    const upsertMock = jest.fn(() => ({ select: selectMock }));
    fromMock.mockReturnValue({ upsert: upsertMock });

    const input = {
      user_id: row.user_id,
      title_id: row.title_id,
      priority: row.priority,
      position: row.position,
      added_at: row.added_at,
      watched_at: row.watched_at,
      removed_at: row.removed_at,
    };

    await expect(watchlistStore.upsertWatchlistItem(input)).resolves.toEqual(row);

    expect(upsertMock).toHaveBeenCalledWith(input, { onConflict: 'user_id,title_id' });
  });
});
