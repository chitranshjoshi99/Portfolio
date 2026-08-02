// The active v1.1 surface owns one local draft only. Pattern interchange stays
// a compact utility, with validation and atomic replacement owned by App.
import { useMemo, useRef, useState } from "react";
import {
  BPM_MAX,
  BPM_MIN,
  DRUM_BY_PAD,
  OCTAVE_MAX,
  OCTAVE_MIN,
  PAD_IDS,
} from "../lib/constants";
import { MAX_PATTERN_DOCUMENT_BYTES, parseBeatDocument } from "../lib/document";
import "./LessonLibrary.css";

// Generic schema prompt for authoring an ORIGINAL groove with an AI assistant.
// Describes the document shape and constraints only — it names no song, artist,
// band, or copyrighted arrangement, and instructs the user to compose their own
// rhythm. Every bound is interpolated from the validator's own constants so the
// prompt cannot drift from what parseBeatDocument accepts. It is pasted into a
// text field, never a file, so it must never mention a file extension.
const PAD_ID_LIST = PAD_IDS.join(", ");
const DRUM_LANE_LIST = PAD_IDS.map(
  (padId) => `"${padId}" = ${DRUM_BY_PAD[padId].label}`,
).join(", ");

const SCHEMA_PROMPT = `Output one original two-bar drum-and-bass groove as raw JSON. Reply with the JSON object only: no prose, no explanation, no markdown fences, no trailing commas, no comments.

Exact shape — these keys and no others:

{
  "bpm": <integer ${BPM_MIN}-${BPM_MAX}>,
  "patterns": {
    "1": { "drums": { "<padId>": [<ascending step indices 0-63>] }, "bass": [ { "step": <0-63>, "pad": "<padId>", "octave": <integer ${OCTAVE_MIN}-${OCTAVE_MAX}>, "length": <1-64> } ] },
    "2": { "drums": {}, "bass": [] },
    "3": { "drums": {}, "bass": [] },
    "4": { "drums": {}, "bass": [] }
  }
}

Hard constraints — a document that breaks any one of these is rejected outright:
- The root object has exactly two keys: "bpm" and "patterns". No title, name, version, metadata, or any other key.
- "patterns" has exactly the four keys "1", "2", "3", "4". Each pattern object has exactly the two keys "drums" and "bass".
- Every pattern is a full two bars = 64 steps, indices 0-63 inclusive. There is no step 64.
- "bpm" is an integer in ${BPM_MIN}..${BPM_MAX}. Not a string, not a decimal.
- Drum lane keys are pad IDs, quoted as strings: ${PAD_ID_LIST}. Omit any silent lane rather than giving it an empty array.
- Each drum lane value is an array of unique integers in 0..63, sorted strictly ascending.
- "bass" is monophonic: one array, sorted strictly ascending by "step", with no two notes overlapping. A note occupies its "step" plus "length" - 1 steps after it.
- "octave" is an integer in ${OCTAVE_MIN}..${OCTAVE_MAX}. 0 is the default register. 3 is invalid. Anything outside ${OCTAVE_MIN}..${OCTAVE_MAX} is rejected.
- "length" is an integer in 1..64 and may wrap the loop (step 63 with length 2 sounds into step 0), but the wrap must not collide with the note at the start of the loop.
- "pad" on a bass note is one of the same pad IDs, quoted as a string.

The pads are chromatic pitch positions: 1=C, 1.5=C#, 2=D, 2.5=D#, 3=E, 4=F, 4.5=F#, 5=G, 5.5=G#, 6=A, 6.5=A#, 7=B. In "drums" the same IDs address the kit: ${DRUM_LANE_LIST}.

Musical direction — the groove must actually sound good, not just validate:
- Pick one of rap/boom-bap, RnB, or blues and commit to it. State nothing about the choice in your output; let the pattern express it.
- Choose a "bpm" that fits the genre (roughly 80-95 for boom-bap, 60-80 for RnB, 70-110 for blues).
- Put the groove in pattern "1" and leave "2", "3", and "4" empty exactly as shown.
- Keep the kick and snare in a clear, repeating relationship, and let the bass lock to the kick.
- Keep bass notes in one key, mostly in octave -1 or 0, using root, fifth, and flat-seventh movement rather than random pitches.
- Leave space. A sparse groove that breathes beats a grid filled with hits.

Compose your own original rhythm. Do not reproduce or approximate any existing song, recording, or arrangement.`;

type Props = {
  // onNew: () => void;
  onExport: (name: string) => void;
  onImport: (file: File) => void;
  hydrated: boolean;
  dirty: boolean;
  saveFailed: boolean;
  importMessage: string | null;
};

export default function LessonLibrary({
  // onNew,
  onExport,
  onImport,
  hydrated,
  dirty,
  saveFailed,
  importMessage,
}: Props) {
  const [exportName, setExportName] = useState("");
  const [file, setFile] = useState(null as File | null);
  // Text of the selected file, read once for live validation.
  const [fileText, setFileText] = useState("");
  // Set when a chosen file is rejected before reading (e.g. over the size cap).
  const [fileError, setFileError] = useState(null as string | null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [copyStatus, setCopyStatus] = useState(null as null | "ok" | "fail");
  // Guards against a stale async file.text() clobbering a newer selection.
  const readIdRef = useRef(0);

  const activeText = pasteOpen ? pasteText : fileText;
  // Parse only when the active text changes, not every render.
  const validation = useMemo(() => {
    if (!activeText.trim()) return null;
    return parseBeatDocument(activeText);
  }, [activeText]);

  // A rejected file (size cap) is invalid even before any parse.
  const activeError = !pasteOpen && fileError ? fileError : null;
  const canImport =
    activeError === null && validation !== null && validation.ok;

  let validityText: string;
  if (activeError) {
    validityText = activeError;
  } else if (validation === null) {
    validityText = "Choose a file or paste a document to import.";
  } else if (validation.ok) {
    validityText = "Valid beat document.";
  } else {
    validityText = validation.error;
  }
  const validityInvalid =
    activeError !== null || (validation !== null && !validation.ok);

  async function handleFileChange(fileList: FileList | null) {
    const chosen = fileList?.[0] ?? null;
    const id = ++readIdRef.current;
    setFile(chosen);
    setFileText("");
    setFileError(null);
    if (!chosen) return;
    if (chosen.size > MAX_PATTERN_DOCUMENT_BYTES) {
      setFileError("Beat document exceeds the 512 KiB limit");
      return;
    }
    const text = await chosen.text();
    if (readIdRef.current !== id) return; // superseded by a newer selection
    setFileText(text);
  }

  function handleImport() {
    if (!canImport) return;
    // Route through onImport (the hook re-parses + saves atomically), keeping
    // the mutation single-sourced.
    // ponytail: the file is read twice — once here to validate, once in the
    // hook — which is fine for a <=512 KiB local file.
    if (pasteOpen) {
      onImport(new File([pasteText], "pasted.beatcoach", { type: "application/json" }));
      return;
    }
    if (file) onImport(file);
  }

  // Copy the generic schema prompt. navigator.clipboard is absent in insecure
  // contexts; writeText can also reject — surface a message instead of throwing.
  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(SCHEMA_PROMPT);
      setCopyStatus("ok");
    } catch {
      setCopyStatus("fail");
    }
  }
  return (
    <section className="lesson-lib" aria-label="Local draft">
      <p className="lesson-lib__heading">Save Beat</p>

      <div className="lesson-lib__save">
        <label className="lesson-lib__field">
          <span className="lesson-lib__field-label">Beat name</span>
          <input
            className="lesson-lib__input"
            type="text"
            value={exportName}
            onChange={(e) => setExportName(e.target.value)}
            placeholder="my lesson"
            maxLength={80}
          />
        </label>
        <button
          type="button"
          className="tbtn"
          onClick={() => onExport(exportName)}
        >
          Export Beat
        </button>
      </div>

      <div className="lesson-lib__save">
        <label className="lesson-lib__field">
          <span className="lesson-lib__field-label">Load Beat</span>
          <input
            className="tbtn"
            type="file"
            accept=".beatcoach,.json,application/json"
            disabled={!hydrated}
            onChange={(event) => {
              void handleFileChange(event.currentTarget.files);
            }}
          />
        </label>
        <button
          type="button"
          className="tbtn"
          onClick={() => setPasteOpen((open) => !open)}
          aria-pressed={pasteOpen}
        >
          {pasteOpen ? "Cancel Paste" : "Paste Beat"}
        </button>
        {pasteOpen && (
        <label className="lesson-lib__field lesson-lib__paste">
          <span className="lesson-lib__field-label">Paste beat document</span>
          <div className="lesson-lib__paste-box">
            <textarea
              className="lesson-lib__textarea"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste a beat document here, then click Import Beat."
              rows={10}
              spellCheck={false}
              autoFocus
            />
            <button
              type="button"
              className="lesson-lib__copy-icon"
              onClick={() => void handleCopyPrompt()}
              // Reset the copied/failed message once the tooltip hides so the
              // next hover shows the original prompt description, not a stuck
              // "copied" state.
              onPointerLeave={() => setCopyStatus(null)}
              onBlur={() => setCopyStatus(null)}
              aria-label="Copy an AI prompt that generates a lesson for you"
              data-tip={
                copyStatus === "ok"
                  ? "Prompt copied"
                  : copyStatus === "fail"
                    ? "Copy failed — select the prompt manually"
                    : "AI prompt to generate a lesson"
              }
              title="AI prompt to generate a lesson"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </div>
        </label>
      )}
        <button
          type="button"
          className="tbtn tbtn--import"
          onClick={handleImport}
          disabled={!canImport}
        >
          Import Beat
        </button>
        <p
          className={
            "lesson-lib__validity" +
            (validityInvalid ? " lesson-lib__validity--invalid" : "")
          }
          role="status"
          aria-live="polite"
        >
          {validityText}
        </p>
      </div>



      <p className="lesson-lib__status" role="status" aria-live="polite">
        {importMessage ??
          (!hydrated
            ? "Restoring local draft…"
            : saveFailed
              ? "Local save failed. Export a backup before closing this page."
              : dirty
                ? "Saving local draft…"
                : "Saved in this browser.")}
      </p>
      <p className="lesson-lib__hint">
        This browser keeps one draft only. Clearing browser data or using a
        private session can erase it; export a backup to keep your beat.
      </p>
    </section>
  );
}
