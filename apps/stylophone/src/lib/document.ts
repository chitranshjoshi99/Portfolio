import {
  BPM_DEFAULT,
  BPM_MAX,
  BPM_MIN,
  OCTAVE_MAX,
  OCTAVE_MIN,
  PAD_IDS,
  type PadId,
} from "./constants";
import { STEPS, emptyPattern, type BassCell, type Pattern } from "./pattern";

export const PATTERN_BARS = 2;
export const MAX_PATTERN_DOCUMENT_BYTES = 512 * 1024;

const SLOT_KEYS = ["1", "2", "3", "4"] as const;
type SlotKey = (typeof SLOT_KEYS)[number];

export type BassNote = { step: number; pad: PadId; octave: number; length: number };

// Bass `length` WRAPS the two-bar loop (a note at step 63 length 2 sounds into
// step 0), matching bassLengthThroughStep/activeBassCell in ./pattern.
export type SlotPattern = {
  // Sorted active step indices per pad; silent lanes are omitted entirely.
  drums: Partial<Record<PadId, number[]>>;
  // Bass notes sorted strictly ascending by step; silent steps are absent.
  bass: BassNote[];
};

export type BeatDocument = {
  bpm: number;
  patterns: Record<SlotKey, SlotPattern>;
};

export type BeatDocumentParseResult =
  | { ok: true; document: BeatDocument }
  | { ok: false; error: string };

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: RecordValue, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key) => keys.includes(key))
  );
}

function isPadId(value: unknown): value is PadId {
  return typeof value === "string" && (PAD_IDS as readonly string[]).includes(value);
}

function invalid(error: string): BeatDocumentParseResult {
  return { ok: false, error };
}

function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (bytes > MAX_PATTERN_DOCUMENT_BYTES) return bytes;
  }
  return bytes;
}

function readBassCell(value: unknown): BassCell | string {
  if (!isRecord(value) || !hasExactKeys(value, ["pad", "octave", "length"])) {
    return "Invalid bass cell";
  }
  if (!isPadId(value.pad)) return "Invalid bass pad";
  const octave = value.octave;
  const length = value.length;
  if (
    typeof octave !== "number" ||
    !Number.isInteger(octave) ||
    octave < OCTAVE_MIN ||
    octave > OCTAVE_MAX
  ) {
    return "Invalid bass octave";
  }
  if (
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > STEPS
  ) {
    return "Invalid bass length";
  }
  return { pad: value.pad, octave, length };
}

// Convert the in-memory dense lanes into the sparse serialized form.
export function toSparsePattern(
  drums: Record<PadId, boolean[]>,
  bass: readonly (BassCell | null)[],
): SlotPattern {
  const sparseDrums: Partial<Record<PadId, number[]>> = {};
  for (const pad of PAD_IDS) {
    const steps: number[] = [];
    drums[pad].forEach((hit, step) => {
      if (hit) steps.push(step);
    });
    if (steps.length > 0) sparseDrums[pad] = steps;
  }
  const notes: BassNote[] = [];
  bass.forEach((cell, step) => {
    if (cell) notes.push({ step, pad: cell.pad, octave: cell.octave, length: cell.length });
  });
  return { drums: sparseDrums, bass: notes };
}

// v4 sparse per-slot validator: sparse step indices per pad and a sorted bass
// note list. Bass length wraps the loop; overlap is rejected.
function readSparsePattern(value: unknown): SlotPattern | string {
  if (!isRecord(value) || !hasExactKeys(value, ["drums", "bass"])) {
    return "Invalid pattern";
  }
  if (!isRecord(value.drums)) return "Invalid drum lanes";

  const drums: Partial<Record<PadId, number[]>> = {};
  for (const key of Object.keys(value.drums)) {
    if (!isPadId(key)) return `Unknown drum pad ${key}`;
    const lane = value.drums[key];
    if (!Array.isArray(lane)) return `Invalid drum lane for pad ${key}`;
    let previous = -1;
    for (const step of lane) {
      if (typeof step !== "number" || !Number.isInteger(step) || step < 0 || step >= STEPS) {
        return `Invalid drum step for pad ${key}`;
      }
      if (step <= previous) return `Drum steps for pad ${key} must be strictly ascending`;
      previous = step;
    }
    if (lane.length > 0) drums[key] = [...lane] as number[];
  }

  if (!Array.isArray(value.bass)) return "Invalid bass lane";
  const bass: BassNote[] = [];
  const occupied = Array<boolean>(STEPS).fill(false);
  let previousStep = -1;
  for (const rawNote of value.bass) {
    if (!isRecord(rawNote) || !hasExactKeys(rawNote, ["step", "pad", "octave", "length"])) {
      return "Invalid bass note";
    }
    const step = rawNote.step;
    if (typeof step !== "number" || !Number.isInteger(step) || step < 0 || step >= STEPS) {
      return `Invalid bass step: ${step}`;
    }
    if (step <= previousStep) return "Bass notes must be strictly ascending by step";
    previousStep = step;
    const cell = readBassCell({ pad: rawNote.pad, octave: rawNote.octave, length: rawNote.length });
    if (typeof cell === "string") return `${cell} at step ${step}`;
    for (let offset = 0; offset < cell.length; offset++) {
      const slot = (step + offset) % STEPS;
      if (occupied[slot]) return `Bass notes overlap at step ${slot}`;
      occupied[slot] = true;
    }
    bass.push({ step, ...cell });
  }
  return { drums, bass };
}

/**
 * Validates unknown data at the persistence/import boundary and returns a
 * freshly allocated four-slot document. The root object must carry exactly
 * { bpm, patterns } and patterns must carry exactly the four slot keys.
 */
export function validateBeatDocument(value: unknown): BeatDocumentParseResult {
  if (!isRecord(value)) return invalid("Beat document must be an object");
  if (!hasExactKeys(value, ["bpm", "patterns"])) {
    return invalid("Beat document has missing or unknown fields");
  }
  const bpm = value.bpm;
  if (
    typeof bpm !== "number" ||
    !Number.isFinite(bpm) ||
    bpm < BPM_MIN ||
    bpm > BPM_MAX
  ) {
    return invalid(`BPM must be from ${BPM_MIN} to ${BPM_MAX}`);
  }
  if (!isRecord(value.patterns) || !hasExactKeys(value.patterns, SLOT_KEYS)) {
    return invalid("Beat document must have exactly patterns 1-4");
  }
  const patterns = {} as Record<SlotKey, SlotPattern>;
  for (const key of SLOT_KEYS) {
    const slot = readSparsePattern(value.patterns[key]);
    if (typeof slot === "string") return invalid(`Pattern ${key}: ${slot}`);
    patterns[key] = slot;
  }
  return { ok: true, document: { bpm, patterns } };
}

export function parseBeatDocument(text: string): BeatDocumentParseResult {
  if (typeof text !== "string") return invalid("Beat document must be text");
  if (utf8ByteLength(text) > MAX_PATTERN_DOCUMENT_BYTES) {
    return invalid("Beat document exceeds the 512 KiB limit");
  }
  try {
    return validateBeatDocument(JSON.parse(text));
  } catch {
    return invalid("Beat document is not valid JSON");
  }
}

// ponytail: static filename — there is no title in the document anymore.
// Slugify the user's name into a safe .beatcoach filename. Empty/punctuation-only
// names fall back to "groove" so the download always has a valid name.
export function beatDocumentFilename(name?: string): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "groove"}.beatcoach`;
}

export function emptyBeatDocument(bpm: number = BPM_DEFAULT): BeatDocument {
  const empty = emptyPattern();
  const patterns = {} as Record<SlotKey, SlotPattern>;
  for (const key of SLOT_KEYS) patterns[key] = toSparsePattern(empty.drums, empty.bass);
  return { bpm, patterns };
}

// Expand one sparse slot into a dense in-memory Pattern.
export function slotPatternToPattern(slot: SlotPattern): Pattern {
  const pattern = emptyPattern();
  for (const pad of PAD_IDS) {
    for (const step of slot.drums[pad] ?? []) {
      pattern.drums[pad][step] = true;
    }
  }
  for (const note of slot.bass) {
    pattern.bass[note.step] = { pad: note.pad, octave: note.octave, length: note.length };
  }
  return pattern;
}

export function patternToSlotPattern(pattern: Pattern): SlotPattern {
  return toSparsePattern(pattern.drums, pattern.bass);
}

function slotsEqual(a: SlotPattern, b: SlotPattern): boolean {
  for (const pad of PAD_IDS) {
    const first = a.drums[pad] ?? [];
    const second = b.drums[pad] ?? [];
    if (first.length !== second.length) return false;
    for (let index = 0; index < first.length; index++) {
      if (first[index] !== second[index]) return false;
    }
  }
  if (a.bass.length !== b.bass.length) return false;
  for (let index = 0; index < a.bass.length; index++) {
    const first = a.bass[index];
    const second = b.bass[index];
    if (
      first.step !== second.step ||
      first.pad !== second.pad ||
      first.octave !== second.octave ||
      first.length !== second.length
    ) {
      return false;
    }
  }
  return true;
}

export function beatDocumentsEqual(a: BeatDocument, b: BeatDocument): boolean {
  if (a === b) return true;
  if (a.bpm !== b.bpm) return false;
  return SLOT_KEYS.every((key) => slotsEqual(a.patterns[key], b.patterns[key]));
}

export function serializeBeatDocument(document: BeatDocument): Blob {
  return new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  });
}

// Pure and intentionally opt-in; useful for a narrow no-DOM regression gate.
export function _selfcheck(): void {
  // Author distinct notes in all four slots, incl. a wrapping bass note.
  const original = emptyBeatDocument(128);
  const s1 = emptyPattern();
  s1.drums["1"][0] = true;
  s1.drums["1"][6] = true;
  s1.bass[63] = { pad: "5", octave: 1, length: 2 }; // wraps 63 -> 0
  original.patterns["1"] = patternToSlotPattern(s1);

  const s2 = emptyPattern();
  s2.drums["2"][8] = true;
  s2.bass[3] = { pad: "3", octave: 0, length: 4 };
  original.patterns["2"] = patternToSlotPattern(s2);

  const s3 = emptyPattern();
  s3.drums["4.5"][2] = true;
  s3.bass[16] = { pad: "1", octave: -1, length: 1 };
  original.patterns["3"] = patternToSlotPattern(s3);

  const s4 = emptyPattern();
  s4.drums["7"][31] = true;
  s4.bass[40] = { pad: "6", octave: 2, length: 3 };
  original.patterns["4"] = patternToSlotPattern(s4);

  const parsed = parseBeatDocument(JSON.stringify(original));
  console.assert(parsed.ok, "valid four-slot document parses");
  if (!parsed.ok) return;
  console.assert(beatDocumentsEqual(original, parsed.document), "document round-trips exactly (wrap)");
  console.assert(parsed.document !== original, "parser allocates a new document");

  // Wrap expands back to a dense pattern that sounds across the loop.
  const restored = slotPatternToPattern(parsed.document.patterns["1"]);
  console.assert(restored.bass[63]?.length === 2, "wrapping bass length survives expansion");

  // Rejections.
  console.assert(!parseBeatDocument("{").ok, "invalid JSON is rejected");
  console.assert(
    !parseBeatDocument(JSON.stringify({ ...original, title: "x" })).ok,
    "unknown root key is rejected",
  );
  console.assert(
    !parseBeatDocument(
      JSON.stringify({ bpm: 128, patterns: { ...original.patterns, "5": original.patterns["1"] } }),
    ).ok,
    "unknown pattern key is rejected",
  );
  const missingSlot = { bpm: 128, patterns: { ...original.patterns } } as {
    bpm: number;
    patterns: Record<string, SlotPattern>;
  };
  delete missingSlot.patterns["4"];
  console.assert(!parseBeatDocument(JSON.stringify(missingSlot)).ok, "missing pattern key is rejected");
  console.assert(
    !parseBeatDocument(" ".repeat(MAX_PATTERN_DOCUMENT_BYTES + 1)).ok,
    "oversized documents are rejected",
  );
  const unsorted = emptyBeatDocument();
  unsorted.patterns["1"] = { drums: { "1": [6, 0] }, bass: [] };
  console.assert(
    !parseBeatDocument(JSON.stringify(unsorted)).ok,
    "non-ascending drum steps are rejected",
  );
  const overlap = emptyBeatDocument();
  overlap.patterns["1"] = {
    drums: {},
    bass: [
      { step: 0, pad: "1", octave: 0, length: 2 },
      { step: 1, pad: "2", octave: 0, length: 1 },
    ],
  };
  console.assert(
    !parseBeatDocument(JSON.stringify(overlap)).ok,
    "overlapping bass holds are rejected",
  );
  const enveloped = {
    schemaVersion: 4,
    id: "0d3f1e18-d826-4b0c-9d5e-6223b1700fbb",
    title: "Old",
    bpm: 120,
    bars: 2,
    steps: 64,
    drumBank: "ROK",
    bassBank: "ROK",
    pattern: { drums: {}, bass: [] },
  };
  console.assert(
    !parseBeatDocument(JSON.stringify(enveloped)).ok,
    "old enveloped documents are rejected",
  );

  // Empty document serializes cleanly and re-validates.
  const empty = emptyBeatDocument();
  console.assert(serializeBeatDocument(empty).size > 0, "empty document serializes without throwing");
  console.assert(validateBeatDocument(empty).ok, "empty document is valid");
}
