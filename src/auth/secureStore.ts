// Token storage in the device secure enclave (Keychain / Keystore).
// Tokens NEVER touch AsyncStorage, logs, or the JS-accessible cache.

import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'rxbd.accessToken';
const REFRESH_KEY = 'rxbd.refreshToken';

const OPTS: SecureStore.SecureStoreOptions = {
  // Only accessible while the device is unlocked, this device only — never
  // synced to iCloud/Keychain backup.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStore = {
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, accessToken, OPTS),
      SecureStore.setItemAsync(REFRESH_KEY, refreshToken, OPTS),
    ]);
  },
  async setAccess(accessToken: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken, OPTS);
  },
  getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_KEY, OPTS);
  },
  getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY, OPTS);
  },
  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY, OPTS),
      SecureStore.deleteItemAsync(REFRESH_KEY, OPTS),
    ]);
  },
};
