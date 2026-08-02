import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import {
  beatDocumentFilename,
  beatDocumentsEqual,
  emptyBeatDocument,
  MAX_PATTERN_DOCUMENT_BYTES,
  parseBeatDocument,
  patternToSlotPattern,
  serializeBeatDocument,
  slotPatternToPattern,
  type BeatDocument,
} from "../lib/document";
import { clearDraft, loadDraft, saveDraft } from "../lib/storage";
import type { PatternBank } from "./usePatternBank";

type PendingReplacement =
  | { kind: "new" | "reset" }
  | { kind: "import"; document: BeatDocument };

// Owns hydrate-on-mount, debounce-free autosave on every valid edit, and the
// export/import/replace flow around the four-slot bank. Applying a loaded
// document reaches into pattern/bpm/guidance state owned by sibling hooks, so
// those setters come in as params.
export function useDraftPersistence(
  patterns: PatternBank,
  replacePatternBank: (patterns: PatternBank) => void,
  bpm: number,
  setBpm: Dispatch<SetStateAction<number>>,
  setGuideCompose: (notice?: string) => void,
  setSelectedBassStep: Dispatch<SetStateAction<number | null>>,
) {
  const [lastSavedDocument, setLastSavedDocument] =
    useState<BeatDocument | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  const [pendingReplacement, setPendingReplacement] =
    useState<PendingReplacement | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importRequestRef = useRef(0);

  const currentDocument = useMemo<BeatDocument>(
    () => ({
      bpm,
      patterns: {
        "1": patternToSlotPattern(patterns["1"]),
        "2": patternToSlotPattern(patterns["2"]),
        "3": patternToSlotPattern(patterns["3"]),
        "4": patternToSlotPattern(patterns["4"]),
      },
    }),
    [bpm, patterns],
  );
  const draftDirty =
    lastSavedDocument === null ||
    !beatDocumentsEqual(currentDocument, lastSavedDocument);

  // Restore all four note slots and the global tempo together. Runtime sound
  // banks are intentionally supplied by usePatternBank, not the document.
  function applyDocument(document: BeatDocument) {
    replacePatternBank({
      "1": slotPatternToPattern(document.patterns["1"]),
      "2": slotPatternToPattern(document.patterns["2"]),
      "3": slotPatternToPattern(document.patterns["3"]),
      "4": slotPatternToPattern(document.patterns["4"]),
    });
    setGuideCompose();
    setBpm(document.bpm);
    setSelectedBassStep(null);
  }

  // Hydrate before enabling persistence: the initial blank React state must
  // never overwrite the one browser draft while localStorage is being read.
  useEffect(() => {
    const saved = loadDraft();
    if (saved) applyDocument(saved);
    setLastSavedDocument(saved);
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each editor change is saved to the one local slot. `lastSavedDocument`
  // only advances after storage accepts the exact validated document, which
  // keeps dirty state meaningful when storage is unavailable or full.
  useEffect(() => {
    if (!draftHydrated || !draftDirty) return;
    if (saveDraft(currentDocument)) {
      setLastSavedDocument(currentDocument);
      setDraftSaveFailed(false);
    } else {
      setDraftSaveFailed(true);
    }
  }, [currentDocument, draftDirty, draftHydrated]);

  function performReplacement(kind: "new" | "reset" = "new") {
    // Clear first so an interrupted replacement does not leave the old draft
    // presented as current on a reload. The following autosave writes the new
    // document; a storage failure remains visible in the utility panel.
    const cleared = clearDraft();
    // Reset clears the grid but keeps the working tempo; "new" starts from the
    // default BPM as before.
    applyDocument(emptyBeatDocument(kind === "reset" ? bpm : undefined));
    setLastSavedDocument(null);
    setDraftSaveFailed(!cleared);
    setPendingReplacement(null);
  }

  function requestReplacement(kind: "new" | "reset") {
    if (draftDirty) {
      setPendingReplacement({ kind });
      return;
    }
    performReplacement(kind);
  }

  // A parsed import is persisted before its editor state is applied. This makes
  // the replacement all-or-nothing from the user's perspective: a storage
  // failure leaves both the active editor and its existing draft untouched.
  function performImport(document: BeatDocument) {
    if (!saveDraft(document)) {
      setDraftSaveFailed(true);
      setImportMessage(
        "Import could not be saved locally. Your current draft was kept.",
      );
      setPendingReplacement(null);
      return;
    }
    applyDocument(document);
    setLastSavedDocument(document);
    setDraftSaveFailed(false);
    setImportMessage("Imported beat.");
    setPendingReplacement(null);
  }

  function requestImport(document: BeatDocument) {
    if (draftDirty) {
      setPendingReplacement({ kind: "import", document });
      return;
    }
    performImport(document);
  }

  async function importPatternDocument(file: File) {
    const request = ++importRequestRef.current;
    setImportMessage(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith(".beatcoach") && !name.endsWith(".json")) {
      setImportMessage("Import rejected: choose a .beatcoach or .json backup file.");
      return;
    }
    if (file.size > MAX_PATTERN_DOCUMENT_BYTES) {
      setImportMessage("Import rejected: file exceeds the 512 KiB limit.");
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      if (request === importRequestRef.current) {
        setImportMessage("Import failed: this file could not be read.");
      }
      return;
    }
    if (request !== importRequestRef.current) return;

    const result = parseBeatDocument(text);
    if (!result.ok) {
      setImportMessage(`Import rejected: ${result.error}`);
      return;
    }
    requestImport(result.document);
  }

  function exportCurrentDocument(name?: string) {
    const blob = serializeBeatDocument(currentDocument);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = beatDocumentFilename(name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // Reset starts a new blank four-slot document but preserves the working
  // tempo — clearing the grid should not lose the BPM.
  function handleResetPattern() {
    requestReplacement("reset");
  }

  return {
    draftHydrated,
    draftDirty,
    draftSaveFailed,
    pendingReplacement,
    setPendingReplacement,
    importMessage,
    importPatternDocument,
    exportCurrentDocument,
    performImport,
    performReplacement,
    handleResetPattern,
  };
}
