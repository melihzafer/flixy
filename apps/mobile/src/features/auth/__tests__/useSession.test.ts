/**
 * Regression tests for the startup session hydration race (login flash).
 *
 * Before the fix, `subscribeToSession` replayed the module-level placeholder
 * EMPTY_SESSION to new subscribers synchronously — before the persisted
 * session had been read from AsyncStorage. `useSession`'s effect wrote that
 * empty session into the query cache, flipping `isLoading` to false with a
 * null session, so the root gate redirected to the auth screens and then
 * bounced to Home 1–2s later once the real session loaded.
 */

const storage = new Map<string, string>();
const pendingReads: Array<() => void> = [];
let deferReads = false;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => {
      if (deferReads) {
        await new Promise<void>((resolve) => {
          pendingReads.push(resolve);
        });
      }
      return storage.get(key) ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), signOut: jest.fn(), onAuthStateChange: jest.fn() } },
  isSupabaseConfigured: false,
}));

jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const SESSION_STORAGE_KEY = 'flixy.local_session.v2';

const storedSession = {
  session: { access_token: 'token', user: { id: 'user-alice@example.com' } },
  user: { id: 'user-alice@example.com' },
  isAnonymous: false,
};

type SessionModule = typeof import('../useSession');

function loadModule(): SessionModule {
  let mod: SessionModule | undefined;
  jest.isolateModules(() => {
    mod = require('../useSession');
  });
  if (!mod) throw new Error('failed to load useSession module');
  return mod;
}

beforeEach(() => {
  storage.clear();
  pendingReads.length = 0;
  deferReads = false;
});

describe('session hydration race', () => {
  it('does not replay the placeholder empty session before storage hydration', () => {
    storage.set(SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    const { subscribeToSession } = loadModule();

    const callback = jest.fn();
    const unsubscribe = subscribeToSession(callback);

    // Nothing has been read from storage yet — the subscriber must NOT be
    // handed the empty placeholder session (that is what caused the login
    // screen to flash before the home redirect).
    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('replays the restored session to late subscribers after hydration', async () => {
    storage.set(SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    const { getLocalSession, subscribeToSession } = loadModule();

    const restored = await getLocalSession();
    expect(restored.user?.id).toBe('user-alice@example.com');

    const callback = jest.fn();
    const unsubscribe = subscribeToSession(callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].user?.id).toBe('user-alice@example.com');
    unsubscribe();
  });

  it('keeps early subscribers silent while a slow storage read is in flight, then notifies on changes', async () => {
    storage.set(SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    deferReads = true;
    const { getLocalSession, setLocalSession, subscribeToSession } = loadModule();

    const hydration = getLocalSession();
    const callback = jest.fn();
    const unsubscribe = subscribeToSession(callback);
    expect(callback).not.toHaveBeenCalled();

    // Release the slow AsyncStorage read.
    deferReads = false;
    for (const release of pendingReads.splice(0)) release();
    const restored = await hydration;
    expect(restored.user?.id).toBe('user-alice@example.com');

    // Post-hydration mutations notify subscribers as before.
    await setLocalSession({ session: null, user: null, isAnonymous: false });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].session).toBeNull();
    unsubscribe();
  });

  it('resolves a guest (null) session for a cold start with nothing stored', async () => {
    const { getLocalSession, subscribeToSession } = loadModule();

    const restored = await getLocalSession();
    expect(restored.session).toBeNull();

    // After hydration the (empty) session is a real answer, so replaying it
    // to subscribers is correct: the root gate can now route to the auth flow.
    const callback = jest.fn();
    const unsubscribe = subscribeToSession(callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].session).toBeNull();
    unsubscribe();
  });
});
