# R5 — Sampled metronome click

**Status:** Done
**Completed:** 2026-07-14

## Locked implementation

- Copied only `StylophoneSamples/Drums/Rok/Stick.wav` to the stable runtime asset `public/rok/stick.wav`. The SHA-256 hashes are identical.
- Replaced the destination-connected `Tone.MembraneSynth` with one `Tone.Player` for `/rok/stick.wav`, connected through its own `Tone.Volume(-18)` bus.
- Kept the existing `Tone.Transport.scheduleRepeat` cadence, beat callbacks, click toggle, and accent decision. The scheduled click now calls `playClickAt(time, accent)` at the same point.
- Regular beats use the player at 0 dB relative to its bus (effective −18 dB); downbeats use +3 dB (effective −15 dB), the allowed maximum. The single player stops/restarts per beat so click tails cannot overlap.

## Files changed

- `src/audio.ts`
- `src/transport.ts`
- `public/rok/stick.wav`

## Verification

| Check | Result |
|---|---|
| `npm run build` | Passed — TypeScript and production Vite bundle completed. |
| `git diff --check` | Passed. |
| Runtime source search | Passed — no `MembraneSynth` or `setInterval` in `src/transport.ts` or `src/audio.ts`. |
| SHA-256 source/runtime pair | Passed — `Stick.wav` and `public/rok/stick.wav` both hash to `71894877f7e5f6da608342eac0eb6c614bec6245e911ffff70309cd07170c95d`. |
| Asset inspection | Passed — runtime asset is a 44.1 kHz, 16-bit mono PCM WAV. |
| Local browser smoke check | Passed at `http://127.0.0.1:5174/` — CLICK toggled false/true and the control/transport path logged no browser errors. |

## Remaining UAT limitation

This environment cannot establish audible headphone and laptop-speaker balance. Confirm the click remains below instruments at 40/120/240 BPM and that the downbeat remains restrained during R11's observable audio regression.
