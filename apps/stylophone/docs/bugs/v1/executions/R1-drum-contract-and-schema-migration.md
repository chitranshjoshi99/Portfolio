# R1 — Drum contract and schema migration

**Status:** Done
**Completed:** 2026-07-14

## Locked implementation

- Added `DRUM_BY_PAD`, keyed by every `PadId`, in the user-confirmed physical order: Kick, Clap, Snare, Rimshot, Claves, Open Hi-Hat, Closed Hi-Hat, Low Tom, Mid Tom, High Tom, Crash, Ride.
- Copied only the twelve locked ROK candidates into `public/rok/` as stable `pad-<id>.wav` runtime assets. SHA-256 checks confirmed every copy matches its supplied source candidate.
- Replaced coarse in-memory drum lanes with `Record<PadId, boolean[]>` and all persisted hit objects with `{ step, pad }`.
- New lesson writes use schema v2. `validateLesson` accepts schema v1 only at the trust boundary and returns a newly allocated v2 lesson with `kick → 1`, `snare → 1.5`, and `hat → 2`; malformed and unsupported input is rejected.
- Playback, recording, cue targeting, and hit checks now keep the exact physical pad identity. The existing three-row editor is a temporary canonical-pad adapter pending R2/R8's 12-row projection.

## Files changed

- `src/constants.ts`
- `src/pattern.ts`
- `src/lesson.ts`
- `src/audio.ts`
- `src/App.tsx`
- `src/StepGrid.tsx`
- `public/rok/pad-{1,1.5,2,2.5,3,4,4.5,5,5.5,6,6.5,7}.wav`

## Verification

| Check | Result |
|---|---|
| `npm run build` | Passed — TypeScript and production Vite bundle completed. |
| `git diff --check` | Passed. |
| Temporary CJS harness for `constants`, `pattern`, and `lesson` self-checks | Passed — verifies all-pad round-trip, schema-v1 migration, schema-v2 writes, and invalid/unsupported lesson rejection. |
| SHA-256 source/runtime WAV pairs | Passed — all 12 runtime copies byte-match the locked source candidates. |
| Regression search | Passed by review — runtime playback no longer chooses a three-zone `padDrum` representative; it selects the exact pad player. |

## Observable checks and remaining UAT limitation

No browser or audible headphone/speaker check was claimed for this data-and-asset migration. The 12-row UI projection belongs to R2/R8, and audible timbre/relative-level UAT remains explicitly required for R11. No source sample under `StylophoneSamples/` was altered.
