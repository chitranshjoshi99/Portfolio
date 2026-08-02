// Serialization seam between the in-memory Pattern and the locked Lesson JSON
// schema. Schema v2 preserves the physical drum pad; v1 is accepted only at
// this trust boundary and is converted into a newly allocated v2 lesson.
import { STEPS, emptyPattern, type Pattern } from "./pattern";
import {
  PAD_IDS,
  OCTAVE_MIN,
  OCTAVE_MAX,
  canonicalPadForReduction,
  type PadId,
} from "./constants";

export type DrumHit = { step: number; pad: PadId };
export type BassNote = { step: number; pad: PadId; octave: number; length: number };
export type DrumLayer = { id: "drums"; type: "drums"; hits: DrumHit[] };
export type BassLayer = { id: "bass"; type: "bass"; notes: BassNote[] };
export type LessonSource = {
  type: "upload" | "youtube" | "manual";
  ref: string;
  clipStart: number;
  clipEnd: number;
};
export type Lesson = {
  schemaVersion: 2;
  id: string;
  title: string;
  source: LessonSource;
  bpm: number;
  bank: "ROK";
  bars: number;
  steps: number;
  layers: [DrumLayer, BassLayer];
  teachOrder: string[];
};

type ValidationResult = { ok: true; lesson: Lesson } | { ok: false; error: string };
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPadId(value: unknown): value is PadId {
  return typeof value === "string" && (PAD_IDS as readonly string[]).includes(value);
}

function invalid(error: string): ValidationResult {
  return { ok: false, error };
}

function readSource(value: unknown): LessonSource | string {
  if (!isRecord(value)) return "Missing or invalid source";
  if (value.type !== "upload" && value.type !== "youtube" && value.type !== "manual") {
    return "Invalid source type";
  }
  if (typeof value.ref !== "string") return "Invalid source ref";
  if (
    !Number.isFinite(value.clipStart) ||
    !Number.isFinite(value.clipEnd) ||
    (value.clipStart as number) < 0 ||
    (value.clipEnd as number) < (value.clipStart as number)
  ) {
    return "Invalid source clip bounds";
  }
  return {
    type: value.type,
    ref: value.ref,
    clipStart: value.clipStart as number,
    clipEnd: value.clipEnd as number,
  };
}

function readCommonFields(obj: RecordValue):
  | { ok: true; fields: Omit<Lesson, "schemaVersion" | "layers"> }
  | { ok: false; error: string } {
  if (typeof obj.id !== "string" || !obj.id) return { ok: false, error: "Missing or invalid id" };
  if (typeof obj.title !== "string") return { ok: false, error: "Missing or invalid title" };
  const source = readSource(obj.source);
  if (typeof source === "string") return { ok: false, error: source };
  if (!Number.isFinite(obj.bpm) || (obj.bpm as number) <= 0) {
    return { ok: false, error: "Missing or invalid bpm" };
  }
  if (obj.bank !== "ROK") return { ok: false, error: "Invalid bank" };
  if (obj.bars !== 2 || obj.steps !== STEPS) return { ok: false, error: "Invalid lesson dimensions" };
  if (!Array.isArray(obj.teachOrder) || obj.teachOrder.some((layer) => typeof layer !== "string")) {
    return { ok: false, error: "Invalid teach order" };
  }
  return {
    ok: true,
    fields: {
      id: obj.id,
      title: obj.title,
      source,
      bpm: obj.bpm as number,
      bank: "ROK",
      bars: 2,
      steps: STEPS,
      teachOrder: [...obj.teachOrder] as string[],
    },
  };
}

function readLayers(obj: RecordValue):
  | { ok: true; drums: RecordValue; bass: RecordValue }
  | { ok: false; error: string } {
  if (!Array.isArray(obj.layers)) return { ok: false, error: "Missing lesson layers" };
  if (obj.layers.length !== 2 || !obj.layers.every(isRecord)) {
    return { ok: false, error: "Invalid lesson layers" };
  }
  const layers = obj.layers as RecordValue[];
  const drums = layers.filter((layer) => layer.id === "drums" && layer.type === "drums");
  const bass = layers.filter((layer) => layer.id === "bass" && layer.type === "bass");
  if (drums.length !== 1 || !Array.isArray(drums[0].hits)) {
    return { ok: false, error: "Missing drums hits" };
  }
  if (bass.length !== 1 || !Array.isArray(bass[0].notes)) {
    return { ok: false, error: "Missing bass notes" };
  }
  return { ok: true, drums: drums[0], bass: bass[0] };
}

function readBassNotes(layer: RecordValue): BassNote[] | string {
  const notes: BassNote[] = [];
  for (const note of layer.notes as unknown[]) {
    if (!isRecord(note)) return "Invalid bass note";
    if (!Number.isInteger(note.step) || (note.step as number) < 0 || (note.step as number) >= STEPS) {
      return `Invalid bass note step: ${note.step}`;
    }
    if (!isPadId(note.pad)) return `Invalid bass pad: "${note.pad}"`;
    if (!Number.isInteger(note.octave) || (note.octave as number) < OCTAVE_MIN || (note.octave as number) > OCTAVE_MAX) {
      return `Invalid bass octave: ${note.octave}`;
    }
    if (!Number.isInteger(note.length) || (note.length as number) < 1) {
      return "Invalid bass note length";
    }
    notes.push({
      step: note.step as number,
      pad: note.pad,
      octave: note.octave as number,
      length: note.length as number,
    });
  }
  return notes;
}

function readDrumHits(layer: RecordValue, schemaVersion: 1 | 2): DrumHit[] | string {
  const hits: DrumHit[] = [];
  for (const hit of layer.hits as unknown[]) {
    if (!isRecord(hit)) return "Invalid drum hit";
    if (!Number.isInteger(hit.step) || (hit.step as number) < 0 || (hit.step as number) >= STEPS) {
      return `Invalid drum hit step: ${hit.step}`;
    }
    if (schemaVersion === 2) {
      if ("sound" in hit) return "Schema v2 drum hits must not include sound";
      if (!isPadId(hit.pad)) return `Invalid drum pad: "${hit.pad}"`;
      hits.push({ step: hit.step as number, pad: hit.pad });
      continue;
    }
    if (hit.sound !== "kick" && hit.sound !== "snare" && hit.sound !== "hat") {
      return `Invalid drum sound: "${hit.sound}"`;
    }
    hits.push({
      step: hit.step as number,
      pad: canonicalPadForReduction(hit.sound),
    });
  }
  return hits;
}

export function patternToLayers(p: Pattern): [DrumLayer, BassLayer] {
  const hits: DrumHit[] = [];
  for (const pad of PAD_IDS) {
    const lane = p.drums[pad];
    for (let step = 0; step < lane.length; step++) {
      if (lane[step]) hits.push({ step, pad });
    }
  }
  const notes: BassNote[] = [];
  for (let step = 0; step < p.bass.length; step++) {
    const cell = p.bass[step];
    if (cell) notes.push({ step, pad: cell.pad, octave: cell.octave, length: cell.length });
  }
  return [
    { id: "drums", type: "drums", hits },
    { id: "bass", type: "bass", notes },
  ];
}

export function layersToPattern(lesson: Lesson): Pattern {
  const p = emptyPattern();
  const [drumLayer, bassLayer] = lesson.layers;
  for (const hit of drumLayer.hits) p.drums[hit.pad][hit.step] = true;
  for (const note of bassLayer.notes) {
    p.bass[note.step] = { pad: note.pad, octave: note.octave, length: note.length };
  }
  return p;
}

export function makeLesson(args: {
  pattern: Pattern;
  bpm: number;
  title: string;
  id?: string;
  source?: LessonSource;
}): Lesson {
  return {
    schemaVersion: 2,
    id: args.id ?? crypto.randomUUID(),
    title: args.title,
    source: args.source ?? { type: "manual", ref: "", clipStart: 0, clipEnd: 0 },
    bpm: args.bpm,
    bank: "ROK",
    bars: 2,
    steps: STEPS,
    layers: patternToLayers(args.pattern),
    teachOrder: ["drums", "bass"],
  };
}

export function validateLesson(obj: unknown): ValidationResult {
  if (!isRecord(obj)) return invalid("Not a valid lesson object");
  if (obj.schemaVersion !== 1 && obj.schemaVersion !== 2) {
    return invalid(`Unsupported schemaVersion: ${obj.schemaVersion} (expected 1 or 2)`);
  }
  const common = readCommonFields(obj);
  if (common.ok === false) return invalid(common.error);
  const layers = readLayers(obj);
  if (layers.ok === false) return invalid(layers.error);
  const hits = readDrumHits(layers.drums, obj.schemaVersion);
  if (typeof hits === "string") return invalid(hits);
  const notes = readBassNotes(layers.bass);
  if (typeof notes === "string") return invalid(notes);

  return {
    ok: true,
    lesson: {
      schemaVersion: 2,
      ...common.fields,
      layers: [
        { id: "drums", type: "drums", hits },
        { id: "bass", type: "bass", notes },
      ],
    },
  };
}

// --- pure self-check (no localStorage/DOM). Guarded off the render path. ---
export function _selfcheck(): void {
  const p = emptyPattern();
  PAD_IDS.forEach((pad, index) => {
    p.drums[pad][index] = true;
  });
  p.bass[2] = { pad: "5", octave: 1, length: 1 };
  p.bass[10] = { pad: "1.5", octave: -2, length: 2 };

  const lesson = makeLesson({ pattern: p, bpm: 120, title: "roundtrip", id: "roundtrip" });
  const back = layersToPattern(lesson);
  console.assert(lesson.schemaVersion === 2, "new lessons write schema v2");
  for (const pad of PAD_IDS) {
    for (let step = 0; step < STEPS; step++) {
      console.assert(back.drums[pad][step] === p.drums[pad][step], `roundtrip drum ${pad}[${step}]`);
    }
  }
  console.assert(validateLesson(lesson).ok === true, "validate roundtrip v2 lesson");

  const v1 = {
    ...lesson,
    schemaVersion: 1,
    layers: [
      { id: "drums", type: "drums", hits: [
        { step: 0, sound: "kick" },
        { step: 1, sound: "snare" },
        { step: 2, sound: "hat" },
      ] },
      lesson.layers[1],
    ],
  };
  const migrated = validateLesson(v1);
  console.assert(
    migrated.ok && migrated.lesson.layers[0].hits.map((hit) => hit.pad).join(",") === "1,1.5,2",
    "migrate v1 drums to canonical pads",
  );
  console.assert(v1.schemaVersion === 1, "migration does not mutate input");

  const invalidPad = validateLesson({
    ...lesson,
    layers: [{ ...lesson.layers[0], hits: [{ step: 0, pad: "9" }] }, lesson.layers[1]],
  });
  console.assert(invalidPad.ok === false, "reject invalid drum pad");
  const redundantSound = validateLesson({
    ...lesson,
    layers: [{ ...lesson.layers[0], hits: [{ step: 0, pad: "1", sound: "kick" }] }, lesson.layers[1]],
  });
  console.assert(redundantSound.ok === false, "reject redundant v2 sound");
  console.assert(validateLesson({ schemaVersion: 3 }).ok === false, "reject unsupported schema version");
}
