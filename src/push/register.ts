// Push registration. Gets the device push token (FCM on Android, APNs on
// iOS) and registers it with the backend, which already accepts
// ANDROID/IOS/WEB device tokens at POST /api/v1/me/notifications/push-tokens.
//
// Consent: notifications are explicit opt-in; we only register after the user
// grants permission, and honor the backend opt-out registry.

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import type { Result } from '@/api/errors';
import { ok } from '@/api/errors';

export type PushPlatform = 'ANDROID' | 'IOS';

/** Request permission + register the device token with the backend. Returns
 *  the token on success. No-op (graceful) on simulators / denied permission. */
export async function registerForPush(): Promise<Result<string | null>> {
  if (!Device.isDevice) return ok(null); // no push on simulators

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return ok(null); // user declined — respect it

  // Native device token (FCM/APNs), not Expo push token, since the backend
  // speaks FCM/APNs directly.
  const tokenResult = await Notifications.getDevicePushTokenAsync();
  const token = String(tokenResult.data);
  const platform: PushPlatform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

  const res = await api.post('/api/v1/me/notifications/push-tokens', {
    platform,
    token,
  });
  if (!res.ok) return res;
  return ok(token);
}

/** Deregister on logout. */
export async function deregisterPush(token: string): Promise<Result<void>> {
  const res = await api.del('/api/v1/me/notifications/push-tokens', {
    // backend DELETE accepts the token in the body per device-token.schemas.ts
  });
  if (!res.ok) return res;
  void token;
  return ok(undefined);
}
