// Draft persistence — protects in-progress form input from loss to an
// app-kill, OS memory eviction, idle-lock, or accidental navigation. Drafts
// are PHI (e.g. a half-written clinical note), so they are stored encrypted
// via the same AES cache codec, with a long TTL.
//
// Security tradeoff: drafts live in the cache store and are therefore wiped on
// hard-logout / session-revoke (along with all PHI). Idle-lock does NOT lose
// them (the LockOverlay keeps the screen mounted and the draft persisted).

import { deleteCache, getCache, putCache } from './cache';

const DRAFT_PREFIX = 'draft:';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function saveDraft<T>(key: string, value: T): Promise<void> {
  await putCache(`${DRAFT_PREFIX}${key}`, value, { ttlMs: DRAFT_TTL_MS, isPhi: true });
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  const entry = await getCache<T>(`${DRAFT_PREFIX}${key}`);
  return entry ? entry.value : null;
}

export async function clearDraft(key: string): Promise<void> {
  await deleteCache(`${DRAFT_PREFIX}${key}`);
}
