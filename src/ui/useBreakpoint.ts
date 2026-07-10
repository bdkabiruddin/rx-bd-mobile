// Breakpoint hook — the dictated tablet contract for master-detail layouts.
// isTablet gates the side-by-side MasterDetail composition; phones keep the
// push-navigation flow.

import { useWindowDimensions } from 'react-native';

/** Pure helper so the boundary is unit-testable without a renderer. */
export function isTabletWidth(width: number): boolean {
  return width >= 768;
}

export function useBreakpoint(): { width: number; isTablet: boolean } {
  const { width } = useWindowDimensions();
  return { width, isTablet: isTabletWidth(width) };
}
