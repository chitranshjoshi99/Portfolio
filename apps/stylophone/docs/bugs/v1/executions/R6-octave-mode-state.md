# R6 — Octave mode state

**Status:** Done
**Completed:** 2026-07-14

## Result

- The octave control group and its readout expose `aria-disabled="true"` in DRUMS mode.
- Both octave buttons use native `disabled` in DRUMS mode, regardless of the selected octave. In BASS mode, the previous minimum/maximum range rules remain intact.
- The selected octave stays visible but muted while unavailable and is preserved on the BASS return; no state reset is introduced.
- Existing mode-change handling already clears/release only the live bass input. It does not stop transport or release the independent sequenced bass voice.

## Files changed

- `src/TransportControls.tsx`
- `src/TransportControls.css`

## Verification

| Check | Result |
|---|---|
| `npm run build` | Passed — TypeScript and production Vite bundle completed. |
| `git diff --check` | Passed. |
| Accessibility source inspection | Passed — both controls are natively disabled in DRUMS; group/readout receive disabled semantics. |
| Local browser behavior | Passed at `http://127.0.0.1:5174/` — DRUMS showed disabled group/buttons; BASS enabled them, changed the value to +1, and restored +1 after a DRUMS/BASS round trip. Browser console had no errors. |
| Live/sequence separation review | Passed — `handleModeChange` releases the live input path only and leaves transport/sequenced playback untouched. |

## Remaining UAT limitation

The local browser pass did not use a physical touch or pen contact to prove live-voice release at the mode boundary. That input/audio check remains part of R11.
