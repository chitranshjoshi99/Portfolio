// Shared instrument constants + types. The single source of truth for pad
// geometry so BeatPad, transport, and later the grid all agree.

// Native hardware pad numbering: 12 pitch positions, one chromatic octave.
// Half-steps skip where a piano has no black key (no 3.5, no 7.5).
// 1=C, 1.5=C#, 2=D, 2.5=D#, 3=E, 4=F, 4.5=F#, 5=G, 5.5=G#, 6=A, 6.5=A#, 7=B.
export const PAD_IDS = [
  "1", "1.5", "2", "2.5", "3", "4", "4.5", "5", "5.5", "6", "6.5", "7",
] as const;

export type PadId = (typeof PAD_IDS)[number];

export function assetPath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

// Banks are a pattern-level sound choice, never data carried by individual
// drum hits or bass notes. ROK remains the native sampled/default voice.
export const BANKS = ["ROK", "HIP", "TEC", "BOX"] as const;
export type Bank = (typeof BANKS)[number];

export type DrumReductionClass = "kick" | "snare" | "hat";

export type DrumDefinition = {
  label: string;
  sample: string;
  reductionClass: DrumReductionClass;
};

// The physical ROK drum layout is the sole source of drum labels, runtime
// samples, and the coarse classes used by reduction/migration. Keep this in
// native pad order; do not infer a different ergonomic order elsewhere.
export const DRUM_BY_PAD: Record<PadId, DrumDefinition> = {
  "1": { label: "Kick drum", sample: assetPath("rok/pad-1.wav"), reductionClass: "kick" },
  "1.5": { label: "Clap", sample: assetPath("rok/pad-1.5.wav"), reductionClass: "snare" },
  "2": { label: "Snare drum", sample: assetPath("rok/pad-2.wav"), reductionClass: "hat" },
  "2.5": { label: "Rimshot", sample: assetPath("rok/pad-2.5.wav"), reductionClass: "snare" },
  "3": { label: "Claves", sample: assetPath("rok/pad-3.wav"), reductionClass: "hat" },
  "4": { label: "Open hi-hat", sample: assetPath("rok/pad-4.wav"), reductionClass: "hat" },
  "4.5": { label: "Closed hi-hat", sample: assetPath("rok/pad-4.5.wav"), reductionClass: "hat" },
  "5": { label: "Low tom", sample: assetPath("rok/pad-5.wav"), reductionClass: "kick" },
  "5.5": { label: "Mid tom", sample: assetPath("rok/pad-5.5.wav"), reductionClass: "snare" },
  "6": { label: "High tom", sample: assetPath("rok/pad-6.wav"), reductionClass: "snare" },
  "6.5": { label: "Crash cymbal", sample: assetPath("rok/pad-6.5.wav"), reductionClass: "hat" },
  "7": { label: "Ride cymbal", sample: assetPath("rok/pad-7.wav"), reductionClass: "hat" },
};

// Reduction has only three classes. Its canonical physical targets are derived
// from DRUM_BY_PAD so the mapping cannot drift from the device configuration.
export function canonicalPadForReduction(
  reductionClass: DrumReductionClass,
): PadId {
  const pad = PAD_IDS.find(
    (padId) => DRUM_BY_PAD[padId].reductionClass === reductionClass,
  );
  if (!pad) throw new Error(`No canonical pad for ${reductionClass}`);
  return pad;
}

export type Mode = "drums" | "bass";

// Presentation stays drums/bass; this separate owner lets the visualizer be
// safely consumed by non-musical controls without widening every audio path.
export type PadMode = "normal" | "pattern" | "transpose" | "delete";

export const BPM_MIN = 40;
export const BPM_MAX = 240;
export const BPM_DEFAULT = 120;

// Octave transpose for bass. Lives in the note data (BassCell.octave); this is
// just the allowed range, -2..+2 (5 values). clampOctave is the single clamp source.
export const OCTAVE_MIN = -2;
export const OCTAVE_MAX = 2;
export const OCTAVE_DEFAULT = 0;

export function clampOctave(n: number): number {
  return Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, n));
}

export function _selfcheck(): void {
  console.assert(BANKS.length === 4, "all v1.1 banks available");
  console.assert(BANKS[0] === "ROK", "ROK is the default bank");
  console.assert(clampOctave(-3) === -2, "clampOctave floor");
  console.assert(clampOctave(3) === 2, "clampOctave ceil");
  console.assert(clampOctave(0) === 0, "clampOctave mid");
  console.assert(clampOctave(-2) === -2, "clampOctave min");
  console.assert(clampOctave(2) === 2, "clampOctave max");
  console.assert(Object.keys(DRUM_BY_PAD).length === PAD_IDS.length, "all drum pads mapped");
  console.assert(canonicalPadForReduction("kick") === "1", "canonical kick pad");
  console.assert(canonicalPadForReduction("snare") === "1.5", "canonical snare pad");
  console.assert(canonicalPadForReduction("hat") === "2", "canonical hat pad");
}
