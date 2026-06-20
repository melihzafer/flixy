import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage adapter for Supabase auth that mirrors the AsyncStorage interface
 * but routes through expo-secure-store. Per DEC-005, refresh / access tokens
 * live in the platform keystore (Keychain / EncryptedSharedPreferences) rather
 * than AsyncStorage so they survive a backup but cannot be read by other apps.
 *
 * SecureStore values are capped at ~2 KB on iOS. We chunk values that exceed
 * that, indexed by `<key>.__chunks` so retrieval can stitch them back.
 */

const CHUNK_SIZE = 1800;
const CHUNK_INDEX_SUFFIX = '.__chunks';

async function setRaw(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

const memoryStore = new Map<string, string>();

const webAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch {}
    return memoryStore.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStore.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStore.delete(key);
  },
};

const nativeAdapter = {
  async getItem(key: string): Promise<string | null> {
    const meta = await SecureStore.getItemAsync(`${key}${CHUNK_INDEX_SUFFIX}`);
    if (!meta) {
      return SecureStore.getItemAsync(key);
    }
    const count = Number.parseInt(meta, 10);
    if (!Number.isFinite(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear any stale chunked layout first.
    await this.removeItem(key);
    if (value.length <= CHUNK_SIZE) {
      await setRaw(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await setRaw(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await setRaw(`${key}${CHUNK_INDEX_SUFFIX}`, String(count));
  },

  async removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(`${key}${CHUNK_INDEX_SUFFIX}`);
    if (meta) {
      const count = Number.parseInt(meta, 10);
      if (Number.isFinite(count)) {
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}.${i}`);
        }
      }
      await SecureStore.deleteItemAsync(`${key}${CHUNK_INDEX_SUFFIX}`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const secureStoreAdapter = Platform.OS === 'web' ? webAdapter : nativeAdapter;
