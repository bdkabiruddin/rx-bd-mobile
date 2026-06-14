// Session state. The in-memory access token is what the HTTP client reads
// synchronously; the refresh token lives only in the secure store. Role +
// branch/department context mirror the web session model.

import { create } from 'zustand';

import { personaForRole } from '@/config/domain';

export type SessionStatus = 'anon' | 'locked' | 'active';

export interface SessionClaims {
  role: string;
  activeBranchId: string | null;
  activeDepartmentId: string | null;
  mfaSatisfied: boolean;
}

interface SessionState extends SessionClaims {
  status: SessionStatus;
  /** In-memory mirror of the secure-store access token (for sync header reads). */
  accessToken: string | null;
  lastActivityAt: number;

  setActive: (accessToken: string, claims: SessionClaims) => void;
  setAccessToken: (accessToken: string) => void;
  setBranch: (branchId: string | null) => void;
  setDepartment: (departmentId: string | null) => void;
  /** Move to locked (biometric required) without clearing tokens. */
  lock: () => void;
  unlock: () => void;
  markActivity: () => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'anon',
  accessToken: null,
  role: '',
  activeBranchId: null,
  activeDepartmentId: null,
  mfaSatisfied: false,
  lastActivityAt: Date.now(),

  setActive: (accessToken, claims) =>
    set({
      status: 'active',
      accessToken,
      ...claims,
      lastActivityAt: Date.now(),
    }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setBranch: (activeBranchId) => set({ activeBranchId }),
  setDepartment: (activeDepartmentId) => set({ activeDepartmentId }),
  lock: () => set({ status: 'locked' }),
  unlock: () => set({ status: 'active', lastActivityAt: Date.now() }),
  markActivity: () => set({ lastActivityAt: Date.now() }),
  clear: () =>
    set({
      status: 'anon',
      accessToken: null,
      role: '',
      activeBranchId: null,
      activeDepartmentId: null,
      mfaSatisfied: false,
    }),
}));

/** Non-hook accessors for modules outside React (e.g. the HTTP client). */
export const sessionAccess = {
  getAccessToken: (): string | null => useSession.getState().accessToken,
  getRole: (): string => useSession.getState().role,
  getPersona: (): string => personaForRole(useSession.getState().role),
};
