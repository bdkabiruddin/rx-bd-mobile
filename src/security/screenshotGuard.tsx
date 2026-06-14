// Screenshot / screen-recording guard for PHI surfaces.
//
// Android: expo-screen-capture applies FLAG_SECURE (also blocks the recents
// preview). iOS: blocks screen recording where supported + the app should
// blur on background (handled in _layout via AppState). Wrap any screen that
// renders PHI with <PhiGuard> or call usePhiScreenGuard() at its top.

import * as ScreenCapture from 'expo-screen-capture';
import * as React from 'react';

const TAG = 'rxbd-phi';

export function usePhiScreenGuard(enabled = true): void {
  React.useEffect(() => {
    if (!enabled) return;
    let active = true;
    void ScreenCapture.preventScreenCaptureAsync(TAG);
    return () => {
      if (active) {
        active = false;
        void ScreenCapture.allowScreenCaptureAsync(TAG);
      }
    };
  }, [enabled]);
}

export function PhiGuard({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}): React.ReactElement {
  usePhiScreenGuard(enabled);
  return <>{children}</>;
}
