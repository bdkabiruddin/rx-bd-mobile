// Multi-branch / multi-department session context. Mirrors the web model:
// after login, list the branches/departments the user can switch to, and
// switch (which re-issues tokens with the new context claim).

import { api } from '@/api/client';
import { type Result, ok } from '@/api/errors';

import { decodeAccessClaims } from './jwt';
import { secureStore } from './secureStore';
import { useSession } from './sessionStore';

export interface BranchOption {
  id: string;
  name: string;
}
export interface DepartmentOption {
  id: string;
  name: string;
}

interface MyBranchesResponse {
  branches?: BranchOption[];
  activeBranchId?: string | null;
  canViewAll?: boolean;
}
interface MyDepartmentsResponse {
  departments?: DepartmentOption[];
  activeDepartmentId?: string | null;
}
interface SwitchResponse {
  accessToken: string;
  refreshToken: string;
}

export async function fetchMyBranches(): Promise<Result<MyBranchesResponse>> {
  return api.get<MyBranchesResponse>('/api/v1/auth/my-branches');
}

export async function fetchMyDepartments(): Promise<Result<MyDepartmentsResponse>> {
  return api.get<MyDepartmentsResponse>('/api/v1/auth/my-departments');
}

/** Switch active branch — the backend re-issues tokens with the new claim;
 *  we persist them and update session context. */
export async function switchBranch(branchId: string): Promise<Result<void>> {
  const res = await api.post<SwitchResponse>('/api/v1/auth/switch-branch', { branchId });
  if (!res.ok) return res;
  await persistSwitched(res.value);
  useSession.getState().setBranch(branchId);
  return ok(undefined);
}

export async function switchDepartment(departmentId: string): Promise<Result<void>> {
  const res = await api.post<SwitchResponse>('/api/v1/auth/switch-department', {
    departmentId,
  });
  if (!res.ok) return res;
  await persistSwitched(res.value);
  useSession.getState().setDepartment(departmentId);
  return ok(undefined);
}

async function persistSwitched(tokens: SwitchResponse): Promise<void> {
  await secureStore.setTokens(tokens.accessToken, tokens.refreshToken);
  const claims = decodeAccessClaims(tokens.accessToken);
  const s = useSession.getState();
  s.setAccessToken(tokens.accessToken);
  if (claims?.branchId !== undefined) s.setBranch(claims.branchId ?? null);
  if (claims?.departmentId !== undefined) s.setDepartment(claims.departmentId ?? null);
}
