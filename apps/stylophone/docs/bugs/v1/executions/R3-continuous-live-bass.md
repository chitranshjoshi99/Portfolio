# R3 — Continuous live bass

**Status:** Done

## Result

- Replaced the fixed-duration live bass path with a dedicated monophonic `Tone.MonoSynth` and attack / `setNote` / release API.
- Kept sequenced bass on a separate monophonic voice so live input does not cut loop playback.
- Added coordinate-based, pointer-captured bass sliding and releases on pointer up, cancel, lost capture, mode change, transport stop, window blur, and component teardown.
- Added Q–] keydown/keyup parity: held keys attack or change the live note and the voice releases when the final key is released.

## Files changed

- `src/audio.ts`
- `src/BeatPad.tsx`
- `src/BeatPad.css`
- `src/App.tsx`

## Verification

| Check | Result |
|---|---|
| `npm run build` | Passed. |
| `git diff --check` | Passed. |
| BeatPad coordinate self-check | Passed — wedge identity is derived from pointer coordinates, with center/outside rejection. |
| Browser smoke check | Passed at `http://127.0.0.1:5173/` — BASS mode selected, the pad rendered with the bass interaction class, and browser console error log was empty. Screenshot inspected in-session. |

## Remaining UAT limitation

This does not certify audible timbre, real-device portamento feel, or all mouse/touch/pen hardware paths. Those observable audio/input checks remain required in R11. Bass duration/recording semantics remain R4.
