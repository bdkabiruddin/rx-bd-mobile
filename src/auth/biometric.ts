// Biometric gate — app-unlock on cold start / post-idle, and step-up for
// two-key reverify. Falls back to device passcode per OS policy.

import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
}

export async function biometricCapability(): Promise<BiometricCapability> {
  const [available, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return { available, enrolled };
}

/**
 * Prompt for biometric (or device-passcode fallback) authentication.
 * Returns true only on a successful, fresh authentication.
 *
 * Policy: if no biometric hardware/enrollment exists, we DO allow the device
 * passcode fallback (disableDeviceFallback: false) so the user is not locked
 * out — but the app still requires *some* local authentication before PHI.
 */
export async function authenticate(promptMessage: string): Promise<boolean> {
  const { available } = await biometricCapability();
  // Even without biometric hardware, authenticateAsync can use the passcode.
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: undefined,
    disableDeviceFallback: false,
    requireConfirmation: false,
  });
  // `available` is informational for callers that want to nudge enrollment.
  void available;
  return result.success;
}
