# R10 — Core drum order UAT evidence

**Status:** Done
**Decision date:** 2026-07-14
**Evidence source:** User-provided physical-device core drum mapping

## Locked decision

| Pad | Voice | Selected ROK candidate |
|---|---|---|
| `1` | Kick drum | `Bd1.wav` |
| `1.5` | Clap | `Clap.wav` |
| `2` | Snare drum | `Snar1.wav` |
| `2.5` | Rimshot | `Rim.wav` |
| `3` | Claves | `Clave.wav` |
| `4` | Open hi-hat | `Ohh1.wav` |
| `4.5` | Closed hi-hat | `Chh1.wav` |
| `5` | Low tom | `Tom2.wav` |
| `5.5` | Mid tom | `Tom4.wav` |
| `6` | High tom | `Tom1.wav` |
| `6.5` | Crash cymbal | `Crash.wav` |
| `7` | Ride cymbal | `Ride1.wav` |

All candidate files were confirmed present under `StylophoneSamples/Drums/Rok/`. The voice order is authoritative for `DRUM_BY_PAD`; no filename-inferred or ergonomic reorder is permitted.

## Scope and remaining verification

This UAT decision resolves ordering only. No runtime code or production assets changed in R10. During R1 the candidates will be copied and mapped, and R11 must validate each sound by ear for recognizable timbre, device fidelity, and relative level.
