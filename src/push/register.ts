// Push registration + tap wiring. Gets the device push token (FCM on
// Android, APNs on iOS) and registers it with the backend, which already
// accepts ANDROID/IOS/WEB device tokens at
// POST /api/v1/me/notifications/push-tokens.
//
// Consent: notifications are explicit opt-in; we only register after the user
// grants permission, and honor the backend opt-out registry.
//
// Deep-linking: usePushDeepLinks() (below) listens for notification taps
// (warm) and the tap that launched the app (cold start), resolves them
// through the pure src/push/deepLink.ts table, and navigates once the
// session is active. Route resolution stays in deepLink.ts so it is
// node-testable; this file owns the expo-notifications / router wiring.

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import type { Result } from '@/api/errors';
import { ok } from '@/api/errors';
import { useSession } from '@/auth/sessionStore';

import { routeForNotificationResponse } from './deepLink';

export type PushPlatform = 'ANDROID' | 'IOS';

/** Token registered in THIS app session — held so logout can deregister it
 *  while the bearer is still valid. */
let currentToken: string | null = null;

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
  currentToken = token;
  return ok(token);
}

/** Best-effort deregistration of the token registered this session. Call
 *  during logout BEFORE the session is cleared (the request needs the
 *  bearer); never throws, clears the held token either way. */
export async function deregisterCurrentPush(): Promise<void> {
  const token = currentToken;
  currentToken = null;
  if (token !== null) await deregisterPush(token);
}

/** Deregister on logout. Action-POST (not DELETE) mirrors the backend:
 *  the token is a device identifier (HIPAA safe-harbor) and belongs in
 *  the body, never in a query string / access log. */
export async function deregisterPush(token: string): Promise<Result<void>> {
  const res = await api.post('/api/v1/me/notifications/push-tokens/unregister', {
    token,
  });
  if (!res.ok) return res;
  return ok(undefined);
}

// ── Notification-tap deep linking ────────────────────────────────────────────

/**
 * Wire push-notification taps to in-app navigation. Mount ONCE at the
 * root (inside the router context — e.g. first line of SessionGate in
 * app/_layout.tsx). Behavior:
 *
 *   - warm taps  → addNotificationResponseReceivedListener
 *   - cold start → getLastNotificationResponseAsync (the tap that
 *                  launched the app)
 *   - the tap is HELD while the session is anon/locked (biometric unlock,
 *     login) and resolved + navigated exactly once when it turns active —
 *     resolution must wait for the session because the route table is
 *     persona-scoped;
 *   - logout (status → anon) drops any held tap so it can never leak
 *     into the next user's session;
 *   - unmappable payloads are dropped silently (deepLink.ts returns null
 *     rather than guessing a route).
 */
export function usePushDeepLinks(): void {
  const router = useRouter();
  const status = useSession((s) => s.status);
  /** The most recent unresolved tap, held until the session is active. */
  const pendingRef = React.useRef<Notifications.NotificationResponse | null>(null);
  /** Dedup key of the last tap we processed — cold-start responses can
   *  ALSO be replayed to the warm listener; navigate exactly once. */
  const handledKeyRef = React.useRef<string | null>(null);

  // Deferred push: the SessionGate's replace-to-persona-home effect runs
  // in the same commit as a flush; pushing on the next tick guarantees the
  // deep link lands ON TOP of the persona home (back returns home) instead
  // of being clobbered by the replace. The hook lives for the app's
  // lifetime, so the timer needs no cleanup.
  const navigateSoon = React.useCallback(
    (route: string) => {
      setTimeout(() => router.push(route as never), 0);
    },
    [router],
  );

  const handleResponse = React.useCallback(
    (response: Notifications.NotificationResponse | null | undefined) => {
      if (!response) return;
      const key = responseKey(response);
      if (key !== null && key === handledKeyRef.current) return; // already handled
      handledKeyRef.current = key;

      if (useSession.getState().status === 'active') {
        const route = routeForNotificationResponse(response);
        if (route) navigateSoon(route);
      } else {
        // Hold the raw response — persona-scoped resolution happens when
        // the session becomes active. Latest tap wins.
        pendingRef.current = response;
      }
    },
    [navigateSoon],
  );

  // Cold start — the notification tap that launched the app, if any.
  React.useEffect(() => {
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled) handleResponse(response);
      })
      .catch(() => undefined); // no response / emitter unavailable — fine
    return () => {
      cancelled = true;
    };
  }, [handleResponse]);

  // Warm taps while the app is alive.
  React.useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [handleResponse]);

  // Session gate — flush the held tap once active; drop it on logout.
  React.useEffect(() => {
    if (status === 'active') {
      const response = pendingRef.current;
      if (response === null) return;
      pendingRef.current = null; // consume BEFORE navigating — exactly once
      const route = routeForNotificationResponse(response);
      if (route) navigateSoon(route);
    } else if (status === 'anon') {
      pendingRef.current = null; // never carry a tap across users
    }
  }, [status, navigateSoon]);
}

/** Stable identity of one tap (request identifier + delivery date). */
function responseKey(response: Notifications.NotificationResponse): string | null {
  try {
    const id = response.notification?.request?.identifier;
    const date = response.notification?.date;
    if (typeof id !== 'string' || id.length === 0) return null;
    return `${id}:${typeof date === 'number' ? date : ''}`;
  } catch {
    return null;
  }
}
