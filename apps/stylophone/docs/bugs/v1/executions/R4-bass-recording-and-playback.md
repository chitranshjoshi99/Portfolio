# R4 — Bass recording and playback

**Status:** Done
**Completed:** 2026-07-14

## Result

- REC-mode bass attack now creates one `BassCell` with the existing `length` field. A held note extends that same cell at transport-step boundaries, capped at the 32-step loop rather than resetting after a full loop.
- A slide closes the prior recorded cell immediately before the current quantized step and starts the new pitch there. A same-step slide replaces the pitch rather than creating an impossible duplicate cell.
- `activeBassCell` resolves sustained notes, including 31 → 0, while a newer explicit cell wins over an overlapping sustain.
- The sequenced `Tone.MonoSynth` now holds its envelope across sustains, uses `setNote` for adjacent pitch changes, releases on a genuine gap, and is released when transport stops. It remains separate from the live bass voice.

## Files changed

- `src/App.tsx`
- `src/audio.ts`
- `src/pattern.ts`

## Verification

| Check | Result |
|---|---|
| `npm run build` | Passed — TypeScript and production Vite bundle completed. |
| Pattern duration self-check bundled with esbuild and executed by Node | Passed — verifies initial length, 31 → 0 sustain/slide behavior, full-loop cap, release after duration, and explicit-cell precedence. |
| `git diff --check` | Passed. |
| Local browser smoke check | Passed at `http://127.0.0.1:5174/` — BASS mode, REC, PLAY, and stop all worked; browser console had no errors. |
| Regression search | No `setInterval` was added to the R4 runtime path. |

## Remaining UAT limitation

This session did not audibly assess portamento feel or test mouse, touch, and pen holds/slides on physical devices. Those observable input/audio checks remain part of R11.
