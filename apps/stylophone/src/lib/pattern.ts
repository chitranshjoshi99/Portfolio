// In-memory pattern store — story 1.4 T2.
// Shape maps 1:1 onto the locked Lesson schema layers: drum hits {step,pad}
// and bass notes {step,pad,octave,length}, over a 64-step (2-bar) grid.
// PURE + IMMUTABLE: every helper returns a NEW Pattern with fresh arrays for
// the changed lane; inputs (React state arrays) are never mutated in place.
import { PAD_IDS, type Bank, type PadId } from "./constants";

export const STEPS = 64;
const BAR_STEPS = STEPS / 2;

export type BassCell = { pad: PadId; octave: number; length: number };

export type Pattern = {
  drumBank: Bank;
  bassBank: Bank;
  drums: Record<PadId, boolean[]>;
  bass: (BassCell | null)[];
};

function stepIndex(step: number): number {
  if (!Number.isFinite(step)) throw new RangeError("Pattern step must be finite");
  return ((Math.trunc(step) % STEPS) + STEPS) % STEPS;
}

export function clampBassLength(length: number): number {
  const integerLength = Number.isFinite(length) ? Math.floor(length) : 1;
  return Math.min(Math.max(integerLength, 1), STEPS);
}

function occupiedBy(start: number, length: number, step: number): boolean {
  return (stepIndex(step) - stepIndex(start) + STEPS) % STEPS < clampBassLength(length);
}

function bassCellsOverlap(
  firstStart: number,
  firstLength: number,
  secondStart: number,
  secondLength: number,
): boolean {
  for (let offset = 0; offset < clampBassLength(firstLength); offset++) {
    if (occupiedBy(secondStart, secondLength, firstStart + offset)) return true;
  }
  return false;
}

export function emptyPattern(): Pattern {
  const drums = {} as Record<PadId, boolean[]>;
  for (const pad of PAD_IDS) drums[pad] = Array<boolean>(STEPS).fill(false);
  return {
    drumBank: "ROK",
    bassBank: "ROK",
    drums,
    bass: Array<BassCell | null>(STEPS).fill(null),
  };
}

export function toggleDrum(p: Pattern, pad: PadId, step: number): Pattern {
  const lane = p.drums[pad].slice();
  const target = stepIndex(step);
  lane[target] = !lane[target];
  return { ...p, drums: { ...p.drums, [pad]: lane } };
}

// Explicit on/off for drag-paint sweeps: a sweep must SET a target state, not
// flip (toggleDrum flips, which would undo cells the sweep just painted). Returns
// the same Pattern when the cell already matches, so re-entering a cell mid-drag
// commits nothing.
export function setDrum(p: Pattern, pad: PadId, step: number, on: boolean): Pattern {
  const target = stepIndex(step);
  if (p.drums[pad][target] === on) return p;
  const lane = p.drums[pad].slice();
  lane[target] = on;
  return { ...p, drums: { ...p.drums, [pad]: lane } };
}

// Quick-fill: REPLACE a drum row with a regular pattern — hits where
// step ≡ offset (mod everyN). Replace (not OR) so a fill always yields a CLEAN
// row regardless of prior state (the acceptance: "×8 → a clean four-on-the-floor").
// Layout is 8 steps/beat, 32 steps/bar (see transport.ts): every8 = one hit per
// beat (four-on-the-floor), every16 offset8 = backbeat (beats 2 & 4).
export function fillRow(p: Pattern, pad: PadId, everyN: number, offset = 0): Pattern {
  const n = Math.max(1, Math.trunc(everyN));
  const lane = Array.from(
    { length: STEPS },
    (_, s) => (((s - Math.trunc(offset)) % n) + n) % n === 0,
  );
  return { ...p, drums: { ...p.drums, [pad]: lane } };
}

export function clearRow(p: Pattern, pad: PadId): Pattern {
  return { ...p, drums: { ...p.drums, [pad]: Array<boolean>(STEPS).fill(false) } };
}

export function clearBassRow(p: Pattern, pad: PadId): Pattern {
  const bass = p.bass.map((cell) => (cell?.pad === pad ? null : cell));
  return { ...p, bass };
}

export function clearPattern(p: Pattern): Pattern {
  const empty = emptyPattern();
  return { ...empty, drumBank: p.drumBank, bassBank: p.bassBank };
}

// Replace bar 2 with bar 1 across the whole pattern. Drums are binary cells;
// bass stores starts with a duration, so destination starts get cloned and are
// clamped at step 63 instead of wrapping past the two-bar loop.
export function duplicateBar1To2(p: Pattern): Pattern {
  const drums = {} as Record<PadId, boolean[]>;
  for (const pad of PAD_IDS) {
    const lane = p.drums[pad].slice();
    for (let step = 0; step < BAR_STEPS; step++) lane[step + BAR_STEPS] = lane[step];
    drums[pad] = lane;
  }

  const bass = p.bass.slice();
  for (let step = BAR_STEPS; step < STEPS; step++) bass[step] = null;
  for (let step = 0; step < BAR_STEPS; step++) {
    const cell = p.bass[step];
    if (!cell) continue;
    const destination = step + BAR_STEPS;
    bass[destination] = {
      ...cell,
      length: Math.min(clampBassLength(cell.length), STEPS - destination),
    };
  }
  return { ...p, drums, bass };
}

export function setBass(p: Pattern, step: number, cell: BassCell): Pattern {
  const target = stepIndex(step);
  const nextCell = { ...cell, length: clampBassLength(cell.length) };
  const bass = p.bass.slice();

  // A start owns every slot in its wrapped hold. Replacing a start therefore
  // removes every other start whose hold intersects it, rather than leaving
  // precedence dependent on insertion order.
  for (let index = 0; index < STEPS; index++) {
    const existing = bass[index];
    if (
      existing &&
      bassCellsOverlap(target, nextCell.length, index, existing.length)
    ) {
      bass[index] = null;
    }
  }
  bass[target] = nextCell;
  return { ...p, bass };
}

export function clearBass(p: Pattern, step: number): Pattern {
  const bass = p.bass.slice();
  bass[stepIndex(step)] = null;
  return { ...p, bass };
}

export function setBassLength(p: Pattern, step: number, length: number): Pattern {
  const target = stepIndex(step);
  const cell = p.bass[target];
  return cell ? setBass(p, target, { ...cell, length }) : p;
}

// A bass length is expressed in 16th-note cells. These helpers deliberately
// wrap at the two-bar loop boundary so a note beginning at 63 can sustain into
// cell 0 without inventing a second duration representation.
export function bassLengthThroughStep(start: number, end: number): number {
  return ((stepIndex(end) - stepIndex(start) + STEPS) % STEPS) + 1;
}

export function bassLengthBeforeStep(start: number, end: number): number {
  return (stepIndex(end) - stepIndex(start) + STEPS) % STEPS;
}

// Resolve the note that is sounding at a step. Searching newest-to-oldest in
// loop order means a newly placed cell takes precedence over an older sustain
// which overlaps it (whether authored by capture or imported data).
export function activeBassCell(
  bass: readonly (BassCell | null)[],
  step: number,
): BassCell | null {
  const target = stepIndex(step);
  for (let distance = 0; distance < STEPS; distance++) {
    const start = (target - distance + STEPS) % STEPS;
    const cell = bass[start];
    if (cell && clampBassLength(cell.length) > distance) {
      return cell;
    }
  }
  return null;
}

// --- pure self-check (no DOM/audio). Guarded off the render path. ---
export function _selfcheck(): void {
  const base = emptyPattern();

  console.assert(base.drumBank === "ROK", "empty pattern defaults drum bank to ROK");
  console.assert(base.bassBank === "ROK", "empty pattern defaults bass bank to ROK");

  const on = toggleDrum(base, "1", 5);
  console.assert(on.drumBank === "ROK" && on.bassBank === "ROK", "drum edits retain banks");
  console.assert(on.drums["1"][5] === true, "toggleDrum on");
  console.assert(base.drums["1"][5] === false, "toggleDrum immutable (input unchanged)");
  console.assert(on.drums["1.5"][5] === false, "toggleDrum leaves other lanes");
  console.assert(on.drums["1"][6] === false, "toggleDrum leaves other steps");

  const off = toggleDrum(on, "1", 5);
  console.assert(off.drums["1"][5] === false, "toggleDrum off");

  const painted = setDrum(base, "1", 5, true);
  console.assert(painted.drums["1"][5] === true, "setDrum on");
  console.assert(base.drums["1"][5] === false, "setDrum immutable (input unchanged)");
  console.assert(painted.drums["1.5"][5] === false, "setDrum leaves other lanes");
  console.assert(setDrum(painted, "1", 5, false).drums["1"][5] === false, "setDrum off clears lit cell");
  console.assert(setDrum(painted, "1", 5, true) === painted, "setDrum no-op returns same Pattern when already matching");

  // fillRow: 8 steps/beat, 32/bar. every8 = four-on-the-floor (one per beat).
  const four = fillRow(base, "1", 8);
  console.assert([0, 8, 16, 24, 32, 40, 48, 56].every((s) => four.drums["1"][s]), "fillRow every8 hits every beat");
  console.assert(!four.drums["1"][1] && !four.drums["1"][4], "fillRow every8 leaves off-beat steps empty");
  console.assert(four.drums["1"].filter(Boolean).length === 8, "fillRow every8 = 8 hits over 64 steps");
  console.assert(base.drums["1"].every((v) => !v), "fillRow immutable (input unchanged)");
  console.assert(four.drums["1.5"].every((v) => !v), "fillRow leaves other lanes");
  // every16 offset8 = backbeat (beats 2 & 4 of each bar).
  const back = fillRow(base, "2", 16, 8);
  console.assert(back.drums["2"].map((v, i) => (v ? i : -1)).filter((i) => i >= 0).join(",") === "8,24,40,56", "fillRow backbeat lands on 2 & 4 of each bar");
  // every8 offset4 = offbeats (the & of each beat).
  const offbeat = fillRow(base, "2", 8, 4);
  console.assert(offbeat.drums["2"][4] && offbeat.drums["2"][12] && !offbeat.drums["2"][0], "fillRow offbeat on the &");

  const emptied = clearRow(four, "1");
  console.assert(emptied.drums["1"].every((v) => !v), "clearRow empties the row");
  console.assert(four.drums["1"][0] === true, "clearRow immutable (input unchanged)");

  const firstBarDrums = setDrum(setDrum(base, "1", 0, true), "2", 31, true);
  const secondBarOverwritten = setDrum(firstBarDrums, "1", 40, true);
  const duplicateDrums = duplicateBar1To2(secondBarOverwritten);
  console.assert(duplicateDrums.drums["1"][32] === true, "duplicate copies bar-1 drum start");
  console.assert(duplicateDrums.drums["2"][63] === true, "duplicate copies bar-1 drum end");
  console.assert(duplicateDrums.drums["1"][40] === false, "duplicate overwrites bar-2 drums");
  console.assert(secondBarOverwritten.drums["1"][40] === true, "duplicate drums immutable");

  for (const pad of PAD_IDS) {
    console.assert(base.drums[pad].length === STEPS, `empty pad lane ${pad}`);
  }
  console.assert(base.bass.length === STEPS, "empty bass lane");

  const cell: BassCell = { pad: "1", octave: 0, length: 1 };
  const withBass = setBass(base, 3, cell);
  console.assert(withBass.drumBank === "ROK" && withBass.bassBank === "ROK", "bass edits retain banks");
  console.assert(withBass.bass[3]?.pad === cell.pad, "setBass set");
  console.assert(withBass.bass[3] !== cell, "setBass copies cell input");
  console.assert(base.bass[3] === null, "setBass immutable (input unchanged)");

  const cleared = clearBass(withBass, 3);
  console.assert(cleared.bass[3] === null, "clearBass clear");
  console.assert(withBass.bass[3]?.pad === cell.pad, "clearBass immutable (input unchanged)");

  console.assert(bassLengthThroughStep(4, 4) === 1, "bass starts at length 1");
  console.assert(bassLengthThroughStep(63, 0) === 2, "bass duration wraps 63 to 0");
  console.assert(bassLengthBeforeStep(63, 0) === 1, "bass slide closes at wrap boundary");
  console.assert(bassLengthThroughStep(0, 63) === STEPS, "bass length caps at one loop");

  const sustained = setBass(base, 63, { pad: "1", octave: 0, length: 2 });
  console.assert(activeBassCell(sustained.bass, 63)?.pad === "1", "bass active at start");
  console.assert(activeBassCell(sustained.bass, 0)?.pad === "1", "bass active across wrap");
  console.assert(activeBassCell(sustained.bass, 1) === null, "bass releases after length");

  const adjacent = setBass(sustained, 0, { pad: "2", octave: 0, length: 1 });
  console.assert(activeBassCell(adjacent.bass, 0)?.pad === "2", "new adjacent bass cell wins");
  console.assert(adjacent.bass[63] === null, "overlapping bass start clears deterministically");

  const clamped = setBass(base, 8, { pad: "1", octave: 0, length: 100 });
  console.assert(clamped.bass[8]?.length === STEPS, "bass length clamps to one loop");
  const shortened = setBassLength(clamped, 8, 0);
  console.assert(shortened.bass[8]?.length === 1, "setBassLength clamps to one cell");

  const bassForDuplicate = emptyPattern();
  bassForDuplicate.bass[4] = { pad: "2", octave: 1, length: 3 };
  bassForDuplicate.bass[31] = { pad: "7", octave: -1, length: 8 };
  bassForDuplicate.bass[40] = { pad: "4", octave: 0, length: 1 };
  const duplicateBass = duplicateBar1To2(bassForDuplicate);
  console.assert(duplicateBass.bass[36]?.pad === "2", "duplicate copies bass start");
  console.assert(duplicateBass.bass[36]?.length === 3, "duplicate preserves in-bar bass length");
  console.assert(duplicateBass.bass[63]?.pad === "7", "duplicate copies final bass start");
  console.assert(duplicateBass.bass[63]?.length === 1, "duplicate clamps final bass sustain");
  console.assert(duplicateBass.bass[40] === null, "duplicate overwrites bar-2 bass starts");
  console.assert(bassForDuplicate.bass[40]?.pad === "4", "duplicate bass immutable");
}
