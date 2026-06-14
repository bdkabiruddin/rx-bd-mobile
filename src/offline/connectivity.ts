// Connectivity state via NetInfo. Drives the offline banner + sync triggers.

import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

interface ConnectivityState {
  online: boolean;
  setOnline: (online: boolean) => void;
}

export const useConnectivity = create<ConnectivityState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

/** Subscribe to online/offline transitions. Returns an unsubscribe fn. */
export function onConnectivityChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Start the NetInfo subscription. Call once at app boot. */
export function startConnectivityWatch(): () => void {
  return NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    const prev = useConnectivity.getState().online;
    if (online !== prev) {
      useConnectivity.getState().setOnline(online);
      for (const l of listeners) l(online);
    }
  });
}

export const isOnline = (): boolean => useConnectivity.getState().online;
