import type { TasteEvent, TasteEventType } from '@flixy/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export type LocalWatchlistItem = {
  id: string;
  user_id: string;
  title_id: string;
  priority: 'top' | 'normal';
  position: number;
  added_at: string;
  watched_at: string | null;
  removed_at: string | null;
};

export type LocalSwipe = {
  event_id: string;
  user_id: string;
  title_id: string;
  direction: string;
  occurred_at: string;
  session_id: string;
  deck_position: number;
  region: string;
  filters_snapshot: Record<string, unknown>;
  is_undone?: boolean;
  /** Legacy queue field retained so pre-snapshot passes still influence taste. */
  genres?: string[];
  title_snapshot?: {
    genres: string[];
    language: string | null;
    kind: 'movie' | 'tv' | null;
  };
};

export type LocalTasteEvent = TasteEvent & {
  userId: string;
};

export type LocalProfile = {
  id: string;
  region: string;
  language: string;
  name?: string;
  handle?: string;
  avatar_url?: string;
  created_at?: string;
};

export type LocalPreferences = {
  user_id: string;
  selected_services: string[];
  selected_genres: string[];
  excluded_genres: string[];
  preferred_languages: string[];
  excluded_languages: string[];
  notifications_enabled: boolean;
  onboarding_completed_at: string | null;
  cold_start_completed_at: string | null;
  updated_at: string;
};

/**
 * A card the user actually SAW at the top of the deck but did not swipe.
 * Consumed by the deck exclusion builder as `shownLast7d` so the next app
 * open leads with unseen titles instead of replaying yesterday's deck.
 */
export type LocalImpression = {
  user_id: string;
  title_id: string;
  seen_at: string;
};

export type LocalCredential = {
  email: string;
  passwordHash: string;
  userId: string;
  createdAt?: string;
};

const WATCHLIST_KEY = 'flixy.local_db.watchlist.v3';
const SWIPES_KEY = 'flixy.local_db.swipes.v3';
const PREFS_KEY = 'flixy.local_db.prefs.v3';
const PROFILE_KEY = 'flixy.local_db.profile.v3';
const CREDENTIALS_KEY = 'flixy.local_db.credentials.v3';
const TASTE_EVENTS_KEY = 'flixy.local_db.taste_events.v1';
const IMPRESSIONS_KEY = 'flixy.local_db.impressions.v1';
const LOCAL_PASSWORD_HASH_PREFIX = 'sha256:';

const SCHEMA_VERSION = 1;

let watchlistCache: LocalWatchlistItem[] = [];
let swipesCache: LocalSwipe[] = [];
let prefsCache: Record<string, LocalPreferences> = {};
let profileCache: Record<string, LocalProfile> = {};
let credentialsCache: Record<string, LocalCredential> = {};
let tasteEventsCache: LocalTasteEvent[] = [];
let impressionsCache: LocalImpression[] = [];
let dbHydrated = false;

// Migration shim for versioned AsyncStorage JSON structures
function parseVersionedData<T>(rawJson: string, defaultValue: T): T {
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === 'object' && 'schema_version' in parsed) {
      // Versioned format: run migrators if schema_version < SCHEMA_VERSION
      return parsed.data as T;
    }
    // Legacy unversioned format
    return parsed as T;
  } catch (e) {
    console.error('Failed to parse versioned data', e);
    return defaultValue;
  }
}

function wrapVersionedData<T>(data: T) {
  return JSON.stringify({
    schema_version: SCHEMA_VERSION,
    data,
  });
}

async function hydrateDb() {
  if (dbHydrated) return;
  try {
    const wl = await AsyncStorage.getItem(WATCHLIST_KEY);
    if (wl) watchlistCache = parseVersionedData<LocalWatchlistItem[]>(wl, []);

    const sw = await AsyncStorage.getItem(SWIPES_KEY);
    if (sw) swipesCache = parseVersionedData<LocalSwipe[]>(sw, []);

    const pr = await AsyncStorage.getItem(PREFS_KEY);
    if (pr) prefsCache = parseVersionedData<Record<string, LocalPreferences>>(pr, {});

    const pf = await AsyncStorage.getItem(PROFILE_KEY);
    if (pf) profileCache = parseVersionedData<Record<string, LocalProfile>>(pf, {});

    const cr = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (cr) credentialsCache = parseVersionedData<Record<string, LocalCredential>>(cr, {});

    const te = await AsyncStorage.getItem(TASTE_EVENTS_KEY);
    if (te) tasteEventsCache = parseVersionedData<LocalTasteEvent[]>(te, []);

    const im = await AsyncStorage.getItem(IMPRESSIONS_KEY);
    if (im) impressionsCache = parseVersionedData<LocalImpression[]>(im, []);

    dbHydrated = true;
  } catch (e) {
    console.error('Failed to hydrate local db', e);
  }
}

async function persistWatchlist() {
  try {
    await AsyncStorage.setItem(WATCHLIST_KEY, wrapVersionedData(watchlistCache));
  } catch (e) {
    console.error('Failed to persist watchlist', e);
  }
}

async function persistSwipes() {
  try {
    await AsyncStorage.setItem(SWIPES_KEY, wrapVersionedData(swipesCache));
  } catch (e) {
    console.error('Failed to persist swipes', e);
  }
}

async function persistPrefs() {
  try {
    await AsyncStorage.setItem(PREFS_KEY, wrapVersionedData(prefsCache));
  } catch (e) {
    console.error('Failed to persist preferences', e);
  }
}

async function persistProfiles() {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, wrapVersionedData(profileCache));
  } catch (e) {
    console.error('Failed to persist profiles', e);
  }
}

async function persistCredentials() {
  try {
    await AsyncStorage.setItem(CREDENTIALS_KEY, wrapVersionedData(credentialsCache));
  } catch (e) {
    console.error('Failed to persist credentials', e);
  }
}

async function persistTasteEvents() {
  try {
    await AsyncStorage.setItem(TASTE_EVENTS_KEY, wrapVersionedData(tasteEventsCache));
  } catch (e) {
    console.error('Failed to persist taste events', e);
  }
}

async function persistImpressions() {
  try {
    await AsyncStorage.setItem(IMPRESSIONS_KEY, wrapVersionedData(impressionsCache));
  } catch (e) {
    console.error('Failed to persist impressions', e);
  }
}

/** Impressions older than this are useless to the deck cooldown — drop them. */
const IMPRESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Hard cap per user so the store can never grow unbounded. */
const IMPRESSION_MAX_PER_USER = 500;

function pruneImpressions(userId: string, nowMs: number): void {
  const cutoff = nowMs - IMPRESSION_RETENTION_MS;
  const kept: LocalImpression[] = [];
  const mine: LocalImpression[] = [];
  for (const imp of impressionsCache) {
    const seenMs = new Date(imp.seen_at).getTime();
    if (!Number.isFinite(seenMs) || seenMs < cutoff) continue;
    if (imp.user_id === userId) mine.push(imp);
    else kept.push(imp);
  }
  mine.sort((a, b) => new Date(b.seen_at).getTime() - new Date(a.seen_at).getTime());
  impressionsCache = [...kept, ...mine.slice(0, IMPRESSION_MAX_PER_USER)];
}

async function hashLocalPassword(password: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  return `${LOCAL_PASSWORD_HASH_PREFIX}${digest}`;
}

const TASTE_EVENT_DEDUPE_MS = 15 * 60 * 1000;

export const localDb = {
  // Clear in-memory caches to prevent session leakage on logout
  async clearUserMemory(): Promise<void> {
    watchlistCache = [];
    swipesCache = [];
    prefsCache = {};
    profileCache = {};
    tasteEventsCache = [];
    impressionsCache = [];
    dbHydrated = false;
  },

  /**
   * Remove a specific user's data from storage and re-hydrate caches so
   * the next user in the same session cannot read the previous one.
   */
  async clearUser(userId: string): Promise<void> {
    await hydrateDb();
    const nextWatchlist: LocalWatchlistItem[] = [];
    for (const item of watchlistCache) {
      if (item.user_id !== userId) nextWatchlist.push(item);
    }
    const nextSwipes: LocalSwipe[] = [];
    for (const s of swipesCache) {
      if (s.user_id !== userId) nextSwipes.push(s);
    }
    const nextPrefs: Record<string, LocalPreferences> = {};
    for (const [id, prefs] of Object.entries(prefsCache)) {
      if (id !== userId) nextPrefs[id] = prefs;
    }
    const nextProfiles: Record<string, LocalProfile> = {};
    for (const [id, profile] of Object.entries(profileCache)) {
      if (id !== userId) nextProfiles[id] = profile;
    }
    const nextTasteEvents = tasteEventsCache.filter((event) => event.userId !== userId);
    const nextImpressions = impressionsCache.filter((imp) => imp.user_id !== userId);

    watchlistCache = nextWatchlist;
    swipesCache = nextSwipes;
    prefsCache = nextPrefs;
    profileCache = nextProfiles;
    tasteEventsCache = nextTasteEvents;
    impressionsCache = nextImpressions;

    await Promise.all([
      persistWatchlist(),
      persistSwipes(),
      persistPrefs(),
      persistProfiles(),
      persistTasteEvents(),
      persistImpressions(),
    ]);
  },

  async getSwipes(userId: string): Promise<LocalSwipe[]> {
    await hydrateDb();
    return swipesCache.filter((s) => s.user_id === userId);
  },

  async getTasteEvents(userId: string): Promise<LocalTasteEvent[]> {
    await hydrateDb();
    return tasteEventsCache.filter((event) => event.userId === userId);
  },

  async recordTasteEvent(input: {
    userId: string;
    itemId: string;
    itemType: 'movie' | 'tv';
    genres: string[];
    eventType: TasteEventType;
    occurredAt?: string;
  }): Promise<LocalTasteEvent | null> {
    await hydrateDb();
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const occurredMs = new Date(occurredAt).getTime();
    const duplicate = tasteEventsCache.some((event) => {
      if (
        event.userId !== input.userId ||
        event.itemId !== input.itemId ||
        event.eventType !== input.eventType
      ) {
        return false;
      }
      const priorMs = new Date(event.occurredAt).getTime();
      return (
        Number.isFinite(occurredMs) &&
        Number.isFinite(priorMs) &&
        Math.abs(occurredMs - priorMs) < TASTE_EVENT_DEDUPE_MS
      );
    });
    if (duplicate) return null;

    const event: LocalTasteEvent = {
      eventId: Crypto.randomUUID(),
      userId: input.userId,
      itemId: input.itemId,
      itemType: input.itemType,
      genres: [...input.genres],
      occurredAt,
      eventType: input.eventType,
    };
    tasteEventsCache.push(event);
    await persistTasteEvents();
    return event;
  },

  /**
   * Record that a title was dealt as the top card. Dedupes on
   * (user, title) by refreshing seen_at; prunes to a 7-day window and a
   * per-user cap on every write.
   */
  async recordImpression(userId: string, titleId: string, seenAt?: string): Promise<void> {
    await hydrateDb();
    const seen_at = seenAt ?? new Date().toISOString();
    const existing = impressionsCache.find(
      (imp) => imp.user_id === userId && imp.title_id === titleId,
    );
    if (existing) existing.seen_at = seen_at;
    else impressionsCache.push({ user_id: userId, title_id: titleId, seen_at });
    pruneImpressions(userId, new Date(seen_at).getTime());
    await persistImpressions();
  },

  /** Title ids the user saw (top of deck) within the last `windowMs`. */
  async getRecentImpressions(
    userId: string,
    windowMs: number = IMPRESSION_RETENTION_MS,
  ): Promise<string[]> {
    await hydrateDb();
    const cutoff = Date.now() - windowMs;
    const out: string[] = [];
    for (const imp of impressionsCache) {
      if (imp.user_id !== userId) continue;
      const seenMs = new Date(imp.seen_at).getTime();
      if (Number.isFinite(seenMs) && seenMs >= cutoff) out.push(imp.title_id);
    }
    return out;
  },

  async getWatchlist(userId: string): Promise<LocalWatchlistItem[]> {
    await hydrateDb();
    return watchlistCache.filter((item) => item.user_id === userId && !item.removed_at);
  },

  async upsertWatchlistItem(item: Omit<LocalWatchlistItem, 'id'>): Promise<LocalWatchlistItem> {
    await hydrateDb();
    const existingIndex = watchlistCache.findIndex(
      (w) => w.user_id === item.user_id && w.title_id === item.title_id,
    );

    let result: LocalWatchlistItem;
    if (existingIndex > -1) {
      result = {
        ...watchlistCache[existingIndex],
        ...item,
      } as LocalWatchlistItem;
      watchlistCache[existingIndex] = result;
    } else {
      result = {
        id: Crypto.randomUUID(),
        ...item,
      } as LocalWatchlistItem;
      watchlistCache.push(result);
    }
    await persistWatchlist();
    return result;
  },

  async updateWatchlistItem(id: string, updates: Partial<LocalWatchlistItem>): Promise<void> {
    await hydrateDb();
    const index = watchlistCache.findIndex((w) => w.id === id);
    if (index > -1) {
      watchlistCache[index] = {
        ...watchlistCache[index],
        ...updates,
      } as LocalWatchlistItem;
      await persistWatchlist();
    }
  },

  async updateWatchlistItemByTitle(
    userId: string,
    titleId: string,
    updates: Partial<LocalWatchlistItem>,
  ): Promise<void> {
    await hydrateDb();
    const index = watchlistCache.findIndex((w) => w.user_id === userId && w.title_id === titleId);
    if (index > -1) {
      watchlistCache[index] = {
        ...watchlistCache[index],
        ...updates,
      } as LocalWatchlistItem;
      await persistWatchlist();
    }
  },

  async insertSwipe(swipe: LocalSwipe): Promise<void> {
    await hydrateDb();
    const existingIndex = swipesCache.findIndex((s) => s.event_id === swipe.event_id);
    if (existingIndex > -1) {
      swipesCache[existingIndex] = swipe;
    } else {
      swipesCache.push(swipe);
    }
    await persistSwipes();
  },

  async updateSwipe(eventId: string, updates: Partial<LocalSwipe>): Promise<void> {
    await hydrateDb();
    const index = swipesCache.findIndex((s) => s.event_id === eventId);
    if (index > -1) {
      swipesCache[index] = {
        ...swipesCache[index],
        ...updates,
      } as LocalSwipe;
      await persistSwipes();
    }
  },

  // Preferences
  async getPreferences(userId: string): Promise<LocalPreferences | null> {
    await hydrateDb();
    return prefsCache[userId] || null;
  },

  async upsertPreferences(
    userId: string,
    updates: Partial<LocalPreferences>,
  ): Promise<LocalPreferences> {
    await hydrateDb();
    const defaults: LocalPreferences = {
      user_id: userId,
      selected_services: [],
      selected_genres: [],
      excluded_genres: [],
      preferred_languages: [],
      excluded_languages: [],
      notifications_enabled: false,
      onboarding_completed_at: null,
      cold_start_completed_at: null,
      updated_at: new Date().toISOString(),
    };
    // Add new preference fields to existing AsyncStorage rows before merging a
    // narrow settings patch. Without this, a legacy row could fail validation
    // the first time a user changes an unrelated setting.
    const existing = { ...defaults, ...(prefsCache[userId] ?? {}) };

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    prefsCache[userId] = updated;
    await persistPrefs();
    return updated;
  },

  // Profiles
  async getProfile(userId: string): Promise<LocalProfile | null> {
    await hydrateDb();
    return profileCache[userId] || null;
  },

  async isHandleTaken(handle: string, excludeUserId: string): Promise<boolean> {
    await hydrateDb();
    const normalized = handle.toLowerCase();
    return Object.values(profileCache).some((p) => {
      if (p.id === excludeUserId) return false;
      const own = p.handle?.toLowerCase();
      if (own === normalized) return true;
      return p.name?.toLowerCase() === normalized;
    });
  },

  async upsertProfile(userId: string, updates: Partial<LocalProfile>): Promise<LocalProfile> {
    await hydrateDb();
    const existing = profileCache[userId] || {
      id: userId,
      region: 'US',
      language: 'en',
      created_at: new Date().toISOString(),
    };

    const updated = {
      ...existing,
      ...updates,
    };

    profileCache[userId] = updated;
    await persistProfiles();
    return updated;
  },

  // Local Credentials (for honest password flows in MVP)
  async getCredential(email: string): Promise<LocalCredential | null> {
    await hydrateDb();
    return credentialsCache[email.toLowerCase()] || null;
  },

  async saveCredential(email: string, password: string, userId: string): Promise<void> {
    await hydrateDb();
    const normalized = email.toLowerCase();
    const existing = credentialsCache[normalized];
    credentialsCache[normalized] = {
      email: normalized,
      passwordHash: await hashLocalPassword(password),
      userId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await persistCredentials();
  },

  async verifyCredential(email: string, password: string): Promise<boolean> {
    await hydrateDb();
    const normalized = email.toLowerCase();
    const credential = credentialsCache[normalized];
    if (!credential) return false;

    const expected = await hashLocalPassword(password);
    if (credential.passwordHash === expected) return true;

    // Migrate development credentials written before hashes were introduced.
    if (!credential.passwordHash.startsWith(LOCAL_PASSWORD_HASH_PREFIX)) {
      const matchesLegacyValue = credential.passwordHash === password;
      if (matchesLegacyValue) {
        credential.passwordHash = expected;
        await persistCredentials();
      }
      return matchesLegacyValue;
    }
    return false;
  },

  async updatePassword(email: string, newPassword: string): Promise<void> {
    await hydrateDb();
    const cred = credentialsCache[email.toLowerCase()];
    if (cred) {
      cred.passwordHash = await hashLocalPassword(newPassword);
      await persistCredentials();
    }
  },

  async deleteCredential(email: string): Promise<void> {
    await hydrateDb();
    const normalized = email.toLowerCase();
    if (!(normalized in credentialsCache)) return;
    delete credentialsCache[normalized];
    await persistCredentials();
  },
};
