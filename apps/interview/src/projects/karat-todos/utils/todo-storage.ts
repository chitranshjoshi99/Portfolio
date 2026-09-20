import { STORAGE_KEY } from '../constants/karat-todos.constants';
import type { PatchMap } from '../karat-todos.types';

/** Blocked / corrupt storage is "no local edits", never a crash. */
export function loadPatches(): PatchMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as PatchMap) : {};
  } catch {
    return {};
  }
}

export function savePatches(patches: PatchMap): void {
  try {
    if (Object.keys(patches).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
  } catch {
    /* quota or private mode — edits still live in memory for this session */
  }
}
