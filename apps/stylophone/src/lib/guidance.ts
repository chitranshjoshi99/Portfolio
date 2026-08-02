// Hardware-companion guidance is derived from the current Pattern only. It is
// deliberately not recording, scoring, or persisted state: each pattern edit
// simply produces a new deterministic sequence of passes.
import { PAD_IDS, type PadId } from "./constants";
import { emptyPattern, type Pattern } from "./pattern";

export type Pass = { kind: "drum"; pad: PadId } | { kind: "bass" };

/** The shared visual/audio state for a derived pass. */
export type PassState = "unreached" | "active" | "passed";

export const PASS_GAIN_DB: Record<PassState, number | null> = {
  unreached: null,
  active: 0,
  passed: -12,
};

export function passGainDb(state: PassState): number | null {
  return PASS_GAIN_DB[state];
}

// Drum passes follow the physical pad order. Bass is a single final pass when
// the pattern contains at least one authored bass start.
export function derivePasses(pattern: Pattern): Pass[] {
  const passes: Pass[] = [];

  for (const pad of PAD_IDS) {
    if (pattern.drums[pad].some(Boolean)) passes.push({ kind: "drum", pad });
  }
  if (pattern.bass.some((cell) => cell !== null)) passes.push({ kind: "bass" });

  return passes;
}

// The active pass, or null before starting / after completing the guide.
export function currentPass(passes: readonly Pass[], index: number): Pass | null {
  return passes[index] ?? null;
}

// Return the index of a matching pass so a user can explicitly revisit a
// completed row without mutating the authored pattern or pass order.
export function redoPass(passes: readonly Pass[], pass: Pass): number {
  return passes.findIndex((candidate) => samePass(candidate, pass));
}

function samePass(first: Pass, second: Pass): boolean {
  return (
    first.kind === second.kind &&
    (first.kind !== "drum" || second.kind !== "drum" || first.pad === second.pad)
  );
}

// `index` is the current pass: -1 means not started and passes.length means
// complete. Unknown or future passes stay unreached.
export function passState(
  passes: readonly Pass[],
  index: number,
  pass: Pass,
): PassState {
  const passIndex = passes.findIndex((candidate) => samePass(candidate, pass));
  if (passIndex === -1 || passIndex > index) return "unreached";
  if (passIndex === index) return "active";
  return "passed";
}

// --- pure self-check (no DOM/audio). Guarded off the render path. ---
export function _selfcheck(): void {
  const patterned = emptyPattern();
  patterned.drums["1"][0] = true;
  patterned.drums["4.5"][10] = true;
  patterned.drums["7"][63] = true;
  patterned.bass[8] = { pad: "1", octave: 0, length: 1 };
  const passes = derivePasses(patterned);

  console.assert(
    passes.map((pass) => (pass.kind === "drum" ? pass.pad : pass.kind)).join() ===
      "1,4.5,7,bass",
    "derivePasses orders populated drums then bass",
  );
  console.assert(currentPass(passes, -1) === null, "currentPass before start");
  console.assert(currentPass(passes, 0)?.kind === "drum", "currentPass first pass");
  console.assert(currentPass(passes, passes.length) === null, "currentPass after completion");
  console.assert(passState(passes, -1, passes[0]) === "unreached", "passState before start");
  console.assert(passState(passes, 0, passes[0]) === "active", "passState active pass");
  console.assert(passState(passes, 0, passes[1]) === "unreached", "passState later pass");
  console.assert(passState(passes, 1, passes[0]) === "passed", "passState redo boundary");
  console.assert(passState(passes, passes.length, passes[0]) === "passed", "passState complete");
  console.assert(passState(passes, passes.length, passes[passes.length - 1]) === "passed", "passState final pass complete");
  console.assert(passState(passes, passes.length, { kind: "drum", pad: "2" }) === "unreached", "passState unknown pass");
  console.assert(passGainDb("unreached") === null, "unreached pass is silent");
  console.assert(passGainDb("active") === 0, "active pass is foreground");
  console.assert(passGainDb("passed") === -12, "passed pass is quieter");
  console.assert(redoPass(passes, { kind: "drum", pad: "4.5" }) === 1, "redoPass finds passed row");
  console.assert(redoPass(passes, { kind: "drum", pad: "2" }) === -1, "redoPass rejects unreached row");

  const bassOnly = emptyPattern();
  bassOnly.bass[0] = { pad: "4", octave: 1, length: 2 };
  console.assert(
    derivePasses(bassOnly).length === 1 && derivePasses(bassOnly)[0].kind === "bass",
    "derivePasses supports bass-only patterns",
  );
  console.assert(derivePasses(emptyPattern()).length === 0, "derivePasses omits empty patterns");
}
