// The active v1.1 persistence boundary is exactly one validated draft. Legacy
// lesson exports remain below only until the active UI is switched in Epic 2.
import { parseBeatDocument, validateBeatDocument, type BeatDocument } from "./document";
import { validateLesson, type Lesson } from "./lesson";

export const DRAFT_KEY = "stylophone-beat:v1.4:draft";
const WALKTHROUGH_SEEN_KEY = "sbc.walkthrough.seen";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(): BeatDocument | null {
  const storage = browserStorage();
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const result = parseBeatDocument(raw);
  return result.ok ? result.document : null;
}

export function saveDraft(document: BeatDocument): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  const result = validateBeatDocument(document);
  if (!result.ok) return false;
  let serialized: string;
  try {
    serialized = JSON.stringify(result.document);
  } catch {
    return false;
  }
  try {
    storage.setItem(DRAFT_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    storage.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

// First-visit walkthrough flag (EPIC-5 Story 3). No storage → can't remember,
// so treat every load as unseen — same accepted behavior as cleared storage.
export function hasSeenWalkthrough(): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    return storage.getItem(WALKTHROUGH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWalkthroughSeen(): void {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(WALKTHROUGH_SEEN_KEY, "1");
  } catch {
    // no-op — worst case the tour relaunches next load
  }
}

const INDEX_KEY = "sbc.lessons.index";
function lessonKey(id: string) {
  return `sbc.lesson.${id}`;
}

export type LessonMeta = { id: string; title: string; updatedAt: number };

function readIndex(): LessonMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // ponytail: index is sorted on write; re-sort on read to survive hand-edits.
    return (parsed as LessonMeta[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveLesson(lesson: Lesson): boolean {
  try {
    localStorage.setItem(lessonKey(lesson.id), JSON.stringify(lesson));
    const index = readIndex().filter((m) => m.id !== lesson.id);
    index.unshift({ id: lesson.id, title: lesson.title, updatedAt: Date.now() });
    index.sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    return true;
  } catch (e) {
    console.error("saveLesson failed", e);
    return false;
  }
}

export function listLessons(): LessonMeta[] {
  return readIndex();
}

export function loadLesson(id: string): Lesson | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(lessonKey(id));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = validateLesson(parsed);
  if (result.ok) return result.lesson;
  console.warn(`loadLesson ${id}: ${result.error}`);
  return null;
}

export function deleteLesson(id: string): void {
  try {
    localStorage.removeItem(lessonKey(id));
    const index = readIndex().filter((m) => m.id !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.error("deleteLesson failed", e);
  }
}
