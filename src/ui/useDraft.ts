// useDraft — autosaving form state that survives app-kill / background /
// idle-lock. Restores any saved draft on mount, debounce-saves on change
// (encrypted), and exposes clear() to call after a successful submit.
//
// Phase-2 input forms (clinical notes, prescriptions, long text) MUST use this
// so a user never loses what they typed. Pair with useWrite for the submit.

import * as React from 'react';

import { clearDraft, loadDraft, saveDraft } from '@/offline/drafts';

const SAVE_DEBOUNCE_MS = 600;

export function useDraft<T>(
  key: string,
  initial: T,
): {
  value: T;
  setValue: (v: T) => void;
  /** Remove the saved draft — call after a successful submit. */
  clear: () => void;
  /** True once the restore attempt has completed. */
  restored: boolean;
} {
  const [value, setValue] = React.useState<T>(initial);
  const [restored, setRestored] = React.useState(false);
  const loadedRef = React.useRef(false);

  // Restore once on mount.
  React.useEffect(() => {
    let active = true;
    void loadDraft<T>(key).then((saved) => {
      if (!active) return;
      if (saved !== null && saved !== undefined) setValue(saved);
      setRestored(true);
      loadedRef.current = true;
    });
    return () => {
      active = false;
    };
  }, [key]);

  // Debounced autosave after the initial restore (so we never overwrite a
  // saved draft with the initial value).
  React.useEffect(() => {
    if (!loadedRef.current) return;
    const h = setTimeout(() => {
      void saveDraft(key, value);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [key, value]);

  const clear = React.useCallback(() => {
    loadedRef.current = false;
    void clearDraft(key);
  }, [key]);

  return { value, setValue, clear, restored };
}
