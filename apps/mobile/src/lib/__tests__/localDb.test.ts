import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `digest-${value}`),
}));

import type { LocalWatchlistItem } from '../localDb';
import { localDb } from '../localDb';

function makeWatchlistItem(
  userId: string,
  titleId: string,
  priority: 'top' | 'normal' = 'normal',
): Omit<LocalWatchlistItem, 'id'> {
  return {
    user_id: userId,
    title_id: titleId,
    priority,
    position: 0,
    added_at: new Date().toISOString(),
    watched_at: null,
    removed_at: null,
  };
}

describe('localDb', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await localDb.clearUserMemory();
  });

  describe('per-user isolation', () => {
    it('keeps watchlist data isolated to the owning user', async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      const titleA = '00000000-0000-4000-a000-000000000001';
      const titleB = '00000000-0000-4000-a000-000000000002';

      await localDb.upsertWatchlistItem(makeWatchlistItem(userA, titleA, 'top'));
      await localDb.upsertWatchlistItem(makeWatchlistItem(userB, titleB, 'normal'));

      const aWatchlist = await localDb.getWatchlist(userA);
      const bWatchlist = await localDb.getWatchlist(userB);

      expect(aWatchlist).toHaveLength(1);
      expect(bWatchlist).toHaveLength(1);
      expect(aWatchlist[0]?.title_id).toBe(titleA);
      expect(bWatchlist[0]?.title_id).toBe(titleB);
    });

    it('clearUser(userId) removes that user but preserves other users', async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      const titleA = '00000000-0000-4000-a000-000000000001';
      const titleB = '00000000-0000-4000-a000-000000000002';

      await localDb.upsertWatchlistItem(makeWatchlistItem(userA, titleA, 'top'));
      await localDb.upsertWatchlistItem(makeWatchlistItem(userB, titleB, 'normal'));

      await localDb.upsertProfile(userA, { name: 'Alice', region: 'US', language: 'en' });
      await localDb.upsertProfile(userB, { name: 'Bob', region: 'TR', language: 'tr' });

      await localDb.clearUser(userA);

      const aWatchlist = await localDb.getWatchlist(userA);
      const bWatchlist = await localDb.getWatchlist(userB);

      expect(aWatchlist).toHaveLength(0);
      expect(bWatchlist).toHaveLength(1);
      expect(bWatchlist[0]?.title_id).toBe(titleB);

      const aProfile = await localDb.getProfile(userA);
      const bProfile = await localDb.getProfile(userB);
      expect(aProfile).toBeNull();
      expect(bProfile).not.toBeNull();
      expect(bProfile?.name).toBe('Bob');
    });

    it('survives a hydrate after a user is cleared from storage', async () => {
      const userA = 'user-a';
      const userB = 'user-b';

      await localDb.upsertWatchlistItem(makeWatchlistItem(userA, 't1', 'top'));
      await localDb.upsertWatchlistItem(makeWatchlistItem(userB, 't2', 'normal'));

      await localDb.clearUser(userA);
      await localDb.clearUserMemory();

      const bWatchlist = await localDb.getWatchlist(userB);
      expect(bWatchlist).toHaveLength(1);
      expect(bWatchlist[0]?.title_id).toBe('t2');
    });

    it('also clears swipes and preferences for the cleared user', async () => {
      const userA = 'user-a';
      const userB = 'user-b';

      await localDb.insertSwipe({
        event_id: 'ev-1',
        user_id: userA,
        title_id: 't1',
        direction: 'right',
        occurred_at: new Date().toISOString(),
        session_id: 's1',
        deck_position: 0,
        region: 'US',
        filters_snapshot: { services: [], genres: [] },
      });
      await localDb.insertSwipe({
        event_id: 'ev-2',
        user_id: userB,
        title_id: 't2',
        direction: 'left',
        occurred_at: new Date().toISOString(),
        session_id: 's2',
        deck_position: 0,
        region: 'TR',
        filters_snapshot: { services: [], genres: [] },
      });

      await localDb.upsertPreferences(userA, { selected_genres: ['action'] });
      await localDb.upsertPreferences(userB, { selected_genres: ['drama'] });

      await localDb.clearUser(userA);

      const aSwipes = await localDb.getSwipes(userA);
      const bSwipes = await localDb.getSwipes(userB);
      expect(aSwipes).toHaveLength(0);
      expect(bSwipes).toHaveLength(1);

      const aPrefs = await localDb.getPreferences(userA);
      const bPrefs = await localDb.getPreferences(userB);
      expect(aPrefs).toBeNull();
      expect(bPrefs?.selected_genres).toEqual(['drama']);
    });
  });

  describe('versioned storage + migration shim', () => {
    it('reads versioned JSON envelopes from storage', async () => {
      const userId = 'user-v1';
      await AsyncStorage.setItem(
        'flixy.local_db.watchlist.v3',
        JSON.stringify({
          schema_version: 1,
          data: [
            {
              id: 'item-1',
              user_id: userId,
              title_id: 't1',
              priority: 'top',
              position: 0,
              added_at: new Date().toISOString(),
              watched_at: null,
              removed_at: null,
            },
          ],
        }),
      );

      await localDb.clearUserMemory();
      const watchlist = await localDb.getWatchlist(userId);
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]?.title_id).toBe('t1');
    });

    it('falls back to legacy unversioned array shape', async () => {
      const userId = 'user-legacy';
      await AsyncStorage.setItem(
        'flixy.local_db.watchlist.v3',
        JSON.stringify([
          {
            id: 'item-legacy',
            user_id: userId,
            title_id: 't-legacy',
            priority: 'normal',
            position: 0,
            added_at: new Date().toISOString(),
            watched_at: null,
            removed_at: null,
          },
        ]),
      );

      await localDb.clearUserMemory();
      const watchlist = await localDb.getWatchlist(userId);
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]?.title_id).toBe('t-legacy');
    });

    it('persists with a schema_version envelope on write', async () => {
      const userId = 'user-write';
      await localDb.upsertWatchlistItem(makeWatchlistItem(userId, 't-write'));

      const raw = await AsyncStorage.getItem('flixy.local_db.watchlist.v3');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(parsed.schema_version).toBe(1);
      expect(Array.isArray(parsed.data)).toBe(true);
      expect(parsed.data[0].title_id).toBe('t-write');
    });
  });

  describe('taste event persistence', () => {
    it('deduplicates repeated detail opens for the same item within 15 minutes', async () => {
      const first = await localDb.recordTasteEvent({
        userId: 'user-a',
        itemId: 'title-a',
        itemType: 'movie',
        genres: ['drama'],
        eventType: 'open_details',
        occurredAt: '2026-07-06T10:00:00.000Z',
      });
      const duplicate = await localDb.recordTasteEvent({
        userId: 'user-a',
        itemId: 'title-a',
        itemType: 'movie',
        genres: ['drama'],
        eventType: 'open_details',
        occurredAt: '2026-07-06T10:10:00.000Z',
      });

      expect(first).not.toBeNull();
      expect(duplicate).toBeNull();
      await expect(localDb.getTasteEvents('user-a')).resolves.toHaveLength(1);
    });

    it('caps stored events per user, dropping the oldest first', async () => {
      const base = new Date('2026-07-06T00:00:00.000Z').getTime();
      for (let i = 0; i < 401; i++) {
        await localDb.recordTasteEvent({
          userId: 'user-a',
          itemId: `title-${i}`,
          itemType: 'movie',
          genres: ['drama'],
          eventType: 'open_details',
          occurredAt: new Date(base + i * 60_000).toISOString(),
        });
      }

      const events = await localDb.getTasteEvents('user-a');
      expect(events).toHaveLength(400);
      // The very first (oldest) event was pruned; the newest survives.
      expect(events.some((e) => e.itemId === 'title-0')).toBe(false);
      expect(events.some((e) => e.itemId === 'title-400')).toBe(true);
    });

    it('survives an in-memory reset and rehydrates from AsyncStorage', async () => {
      await localDb.recordTasteEvent({
        userId: 'user-a',
        itemId: 'title-a',
        itemType: 'tv',
        genres: ['sci_fi'],
        eventType: 'watch_trailer',
      });

      await localDb.clearUserMemory();

      const events = await localDb.getTasteEvents('user-a');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        itemId: 'title-a',
        itemType: 'tv',
        genres: ['sci_fi'],
        eventType: 'watch_trailer',
      });
    });
  });

  describe('isHandleTaken', () => {
    it('returns true when another user already has the same handle', async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      await localDb.upsertProfile(userA, { handle: 'cinephile' });
      await localDb.upsertProfile(userB, { handle: 'watcher' });

      const taken = await localDb.isHandleTaken('cinephile', userB);
      expect(taken).toBe(true);
    });

    it('returns true when another user has the same display name (legacy fallback)', async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      await localDb.upsertProfile(userA, { name: 'Cinephile' });
      await localDb.upsertProfile(userB, { name: 'Watcher' });

      const taken = await localDb.isHandleTaken('cinephile', userB);
      expect(taken).toBe(true);
    });

    it('returns false for the same user keeping their own handle', async () => {
      const userA = 'user-a';
      await localDb.upsertProfile(userA, { handle: 'cinephile' });

      const taken = await localDb.isHandleTaken('cinephile', userA);
      expect(taken).toBe(false);
    });

    it('handles are case-insensitive across users', async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      await localDb.upsertProfile(userA, { handle: 'Cinephile' });
      await localDb.upsertProfile(userB, { name: 'Watcher' });

      const taken = await localDb.isHandleTaken('cinephile', userB);
      expect(taken).toBe(true);
    });

    it('returns false when the handle is unused', async () => {
      const taken = await localDb.isHandleTaken('brand-new', 'user-a');
      expect(taken).toBe(false);
    });
  });

  describe('handle persistence', () => {
    it('stores handle separately from display name across upserts', async () => {
      const userId = 'user-handle';
      await localDb.upsertProfile(userId, { name: 'Melih', handle: 'cinephile' });

      const afterCreate = await localDb.getProfile(userId);
      expect(afterCreate?.handle).toBe('cinephile');
      expect(afterCreate?.name).toBe('Melih');

      await localDb.upsertProfile(userId, { name: 'Melih A.' });
      const afterDisplayUpdate = await localDb.getProfile(userId);
      expect(afterDisplayUpdate?.handle).toBe('cinephile');
      expect(afterDisplayUpdate?.name).toBe('Melih A.');

      await localDb.upsertProfile(userId, { handle: 'mel' });
      const afterHandleUpdate = await localDb.getProfile(userId);
      expect(afterHandleUpdate?.handle).toBe('mel');
      expect(afterHandleUpdate?.name).toBe('Melih A.');
    });

    it('clearUser also removes the handle so a re-signup is allowed', async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      await localDb.upsertProfile(userA, { handle: 'cinephile' });
      await localDb.upsertProfile(userB, { handle: 'watcher' });

      await localDb.clearUser(userA);

      const taken = await localDb.isHandleTaken('cinephile', 'fresh-user');
      expect(taken).toBe(false);
    });
  });

  describe('profile partial upsert (data-loss regression)', () => {
    it('preserves existing region/language when an upsert omits them', async () => {
      // Regression guard for bug-109: useUpdateProfile previously spread
      // `undefined` for region/language on a partial edit (name/handle/avatar),
      // which overwrote the user's region + language via the merge in
      // upsertProfile. The hook now only passes present keys; this test pins
      // the merge contract the hook relies on.
      const userId = 'user-partial';
      await localDb.upsertProfile(userId, { name: 'Melih', region: 'TR', language: 'tr' });

      // Simulate the fixed hook: edit only the display name.
      await localDb.upsertProfile(userId, { name: 'Melih A.' });

      const after = await localDb.getProfile(userId);
      expect(after?.name).toBe('Melih A.');
      expect(after?.region).toBe('TR');
      expect(after?.language).toBe('tr');
    });

    it('preserves existing name/handle when an upsert only touches region/language', async () => {
      const userId = 'user-partial-2';
      await localDb.upsertProfile(userId, {
        name: 'Melih',
        handle: 'cinephile',
        region: 'US',
        language: 'en',
      });

      await localDb.upsertProfile(userId, { region: 'TR', language: 'tr' });

      const after = await localDb.getProfile(userId);
      expect(after?.region).toBe('TR');
      expect(after?.language).toBe('tr');
      expect(after?.name).toBe('Melih');
      expect(after?.handle).toBe('cinephile');
    });
  });

  describe('local credentials', () => {
    it('saves and retrieves credentials keyed by lowercase email', async () => {
      await localDb.saveCredential('User@Flixy.app', 'hash-1', 'user-user@flixy.app');
      const cred = await localDb.getCredential('user@flixy.app');
      expect(cred).not.toBeNull();
      expect(cred?.passwordHash).toBe('sha256:digest-hash-1');
      expect(cred?.userId).toBe('user-user@flixy.app');
    });

    it('updates password for an existing credential', async () => {
      await localDb.saveCredential('a@flixy.app', 'old-hash', 'user-a@flixy.app');
      await localDb.updatePassword('a@flixy.app', 'new-hash');
      const cred = await localDb.getCredential('a@flixy.app');
      expect(cred?.passwordHash).toBe('sha256:digest-new-hash');
      expect(cred?.userId).toBe('user-a@flixy.app');
    });

    it('updatePassword is a no-op for unknown email', async () => {
      await expect(localDb.updatePassword('nobody@flixy.app', 'x')).resolves.toBeUndefined();
    });

    it('deletes only the requested credential from memory and storage', async () => {
      await localDb.saveCredential('first@flixy.app', 'first-password', 'user-first');
      await localDb.saveCredential('second@flixy.app', 'second-password', 'user-second');

      await localDb.deleteCredential('FIRST@flixy.app');

      await expect(localDb.getCredential('first@flixy.app')).resolves.toBeNull();
      await expect(localDb.getCredential('second@flixy.app')).resolves.toMatchObject({
        userId: 'user-second',
      });

      await localDb.clearUserMemory();
      await expect(localDb.getCredential('first@flixy.app')).resolves.toBeNull();
      await expect(localDb.getCredential('second@flixy.app')).resolves.toMatchObject({
        userId: 'user-second',
      });
    });

    it('verifies hashed credentials without storing the raw password', async () => {
      await localDb.saveCredential('safe@flixy.app', 'secret-value', 'user-safe');

      await expect(localDb.verifyCredential('safe@flixy.app', 'secret-value')).resolves.toBe(true);
      await expect(localDb.verifyCredential('safe@flixy.app', 'wrong-value')).resolves.toBe(false);

      const raw = await AsyncStorage.getItem('flixy.local_db.credentials.v3');
      expect(raw).not.toContain('"passwordHash":"secret-value"');
      expect(raw).toContain('sha256:digest-secret-value');
    });

    it('round-trips sign-up + sign-out + sign-in against the same user_id', async () => {
      // Sign up stores the credential with a stable user_id.
      await localDb.saveCredential('round@flixy.app', 'pw-1', 'user-round@flixy.app');
      const afterSignUp = await localDb.getCredential('round@flixy.app');
      expect(afterSignUp?.userId).toBe('user-round@flixy.app');

      // User data is keyed by that user_id.
      await localDb.upsertProfile('user-round@flixy.app', { name: 'Roundtrip' });
      const profile = await localDb.getProfile('user-round@flixy.app');
      expect(profile?.name).toBe('Roundtrip');

      // Sign in reads the same user_id; profile survives the round trip.
      const reloaded = await localDb.getCredential('round@flixy.app');
      expect(reloaded?.userId).toBe('user-round@flixy.app');
      const profileAfter = await localDb.getProfile(reloaded?.userId ?? '');
      expect(profileAfter?.name).toBe('Roundtrip');
    });
  });
});
