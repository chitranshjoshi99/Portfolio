// Hit-window logic — the pure seam for "did the player land on a target step?" (EPIC-4).
// Steps live on a loopSteps-long ring, so distance is circular (the loop seam wraps).
// PURE: no side effects, no Tone/DOM; just number logic over (targets, now, tol).
import { STEPS } from "./pattern";

// Minimum circular distance (in steps) from `now` to any target step over a
// loopSteps-long loop; Infinity when there are no targets.
export function nearestStepDistance(targets: number[], now: number, loopSteps = STEPS): number {
  let best = Infinity;
  for (const t of targets) {
    const raw = Math.abs(t - now);
    const circular = Math.min(raw, loopSteps - raw);
    if (circular < best) best = circular;
  }
  return best;
}

// True when the nearest target is within the tolerance window.
export function isHit(targets: number[], now: number, tol: number, loopSteps = STEPS): boolean {
  return nearestStepDistance(targets, now, loopSteps) <= tol;
}

// --- pure self-check (no DOM/audio). Guarded off the render path. ---
export function _selfcheck(): void {
  console.assert(isHit([], 5, 1) === false, "no targets => miss");
  console.assert(nearestStepDistance([5], 5) === 0, "exact hit");
  console.assert(nearestStepDistance([0], 63.5) === 0.5, "wraparound across 64-step loop seam");
  console.assert(isHit([8], 9.4, 1.5) === true, "just inside window");
  console.assert(isHit([8], 9.6, 1.5) === false, "just outside window");
  console.assert(nearestStepDistance([4, 20], 19) === 1, "picks nearer target");
}
