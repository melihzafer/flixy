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

import { isInInstallCooldown, recordInstallAccepted, recordInstallDismissed } from '../pwaInstall';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('pwaInstall cooldown logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock('@react-native-async-storage/async-storage').default.clear();
  });

  it('is not in cooldown before any dismissal', async () => {
    expect(await isInInstallCooldown(Date.now())).toBe(false);
  });

  it('stays in cooldown for 7 days after a first dismissal', async () => {
    const now = 1_000_000;
    await recordInstallDismissed(now);
    expect(await isInInstallCooldown(now + DAY_MS)).toBe(true);
    expect(await isInInstallCooldown(now + 7 * DAY_MS - 1)).toBe(true);
    expect(await isInInstallCooldown(now + 7 * DAY_MS + 1)).toBe(false);
  });

  it('extends cooldown to 30 days after a second dismissal', async () => {
    const now = 1_000_000;
    await recordInstallDismissed(now);
    await recordInstallDismissed(now + 8 * DAY_MS);
    expect(await isInInstallCooldown(now + 8 * DAY_MS + 29 * DAY_MS)).toBe(true);
    expect(await isInInstallCooldown(now + 8 * DAY_MS + 31 * DAY_MS)).toBe(false);
  });

  it('never shows again once accepted, regardless of elapsed time', async () => {
    await recordInstallAccepted();
    expect(await isInInstallCooldown(Date.now() + 1000 * DAY_MS)).toBe(true);
  });
});
