// Original, hand-composed 2-bar demo groove for the first-visit walkthrough —
// not transcribed from any existing song (Legal-bro, v1.2). Built from the
// same pure Pattern helpers any authored edit uses, so it stays schema-
// identical to a saved pattern with zero new pattern-mutation code path.
// Populates both drums and bass so derivePasses() emits a bass guidance pass
// too (Architect, v1.2 pre-build audit lock) — a drums-only groove would
// silently skip it.
import { emptyPattern, setBass, toggleDrum, type Pattern } from "./pattern";

function buildDemoGroove(): Pattern {
  let p = emptyPattern();

  const kickSteps = [0, 8, 16, 24, 32, 40, 48, 56];
  const clapSteps = [8, 24, 40, 56];
  const hatSteps = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60];

  for (const step of kickSteps) p = toggleDrum(p, "1", step);
  for (const step of clapSteps) p = toggleDrum(p, "1.5", step);
  for (const step of hatSteps) p = toggleDrum(p, "4.5", step);

  // Simple original C-F-G-C root motion, one bass note per half-bar.
  p = setBass(p, 0, { pad: "2", octave: -1, length: 6 });
  p = setBass(p, 6, { pad: "3", octave: -1, length: 6 });
  p = setBass(p, 12, { pad: "2", octave: -1, length: 6 });
  p = setBass(p, 32, { pad: "5", octave: -1, length: 16 });
  p = setBass(p, 48, { pad: "1", octave: -1, length: 16 });

  return p;
}

export const DEMO_GROOVE: Pattern = buildDemoGroove();
