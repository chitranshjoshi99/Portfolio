# CC0 sample credits — v1.2 audio relicense (EPIC 2, kit v2)

All 13 files below are the shipped drum kit in `public/rok/` (this directory is the
staging mirror at the same filenames). Every file is CC0 ("Creative Commons 0").
This kit replaces the first CC0 kit (2026-07-16), which was rejected in listen-through:
synth D&B kick/snare, a digitally silent ride, and cross-kit tonal chaos
(see docs/executions/v1.2/EPIC-2-audio-relicense.json). CC0 requires no attribution,
but this record is kept as proof of clean provenance, per Legal-bro's v1.2 decision.

Kit assembled 2026-07-17 after two audition rounds (human listen-through, A/B page).

## Sources

Three source sets, chosen for coherence:

1. **Sonic Pi bundled samples** (github.com/sonic-pi-net/sonic-pi, `etc/samples/`) —
   all individually CC0, per-file Freesound provenance in Sonic Pi's
   `etc/samples/README.md`. Kick + toms + hats + cymbals; toms/hats/cymbals all come
   from one creator's kit (menegass), recorded as one session.
2. **Virtuosity Drums** (github.com/sfzinstruments/virtuosity_drums) — CC0 (LICENSE in
   repo), by Versilian Studios + Karoryfer Samples. Snare + rimshot (same drum, same
   session, mid mics).
3. **Freesound one-shots** (individually CC0 on their sound pages) — clap + claves.

| File | Voice | Source sample | Origin / provenance | License |
|---|---|---|---|---|
| `pad-1.wav` | Kick drum | Sonic Pi `drum_heavy_kick` | https://freesound.org/people/Zajo/sounds/4832/ | CC0 |
| `pad-1.5.wav` | Clap | "clap_8" (Clap One-Shots 2) | https://freesound.org/people/DigitalUnderglow/sounds/745868/ | CC0 |
| `pad-2.wav` | Snare drum | Virtuosity `mid_snare_center_vl30` | https://github.com/sfzinstruments/virtuosity_drums | CC0 |
| `pad-2.5.wav` | Rimshot | Virtuosity `mid_snare_rimshot_vl10` | https://github.com/sfzinstruments/virtuosity_drums | CC0 |
| `pad-3.wav` | Claves | "claveshi.wav" | https://freesound.org/people/MarleneAyni/sounds/90017/ | CC0 |
| `pad-4.wav` | Open hi-hat | Sonic Pi `drum_cymbal_open` | https://freesound.org/people/menegass/sounds/100055/ | CC0 |
| `pad-4.5.wav` | Closed hi-hat | Sonic Pi `drum_cymbal_closed` | https://freesound.org/people/menegass/sounds/100053/ | CC0 |
| `pad-5.wav` | Low tom | Sonic Pi `drum_tom_lo_hard` | https://freesound.org/people/menegass/sounds/100064/ | CC0 |
| `pad-5.5.wav` | Mid tom | Sonic Pi `drum_tom_mid_hard` | https://freesound.org/people/menegass/sounds/100066/ | CC0 |
| `pad-6.wav` | High tom | Sonic Pi `drum_tom_hi_hard` | https://freesound.org/people/menegass/sounds/100062/ | CC0 |
| `pad-6.5.wav` | Crash cymbal | Sonic Pi `drum_splash_hard` | https://freesound.org/people/menegass/sounds/100060/ | CC0 |
| `pad-7.wav` | Ride cymbal | Sonic Pi `drum_cymbal_soft` | https://freesound.org/people/menegass/sounds/100057/ | CC0 |
| `stick.wav` | Metronome click | Sonic Pi `elec_tick` | https://freesound.org/people/looppool/sounds/13113/ | CC0 |

## Processing applied

All files converted to 44.1 kHz / 16-bit stereo PCM WAV, peak-normalized to a fixed
kit-balance map (kick 0 dB ref at -1 dBFS; snare -1; toms -2; rimshot/clap -3;
crash -4; open hat/claves/ride/stick -6; closed hat -7). Virtuosity multisamples were
trimmed of leading silence, capped with fade-out. `pad-1.5.wav` and `pad-3.wav` were
sourced from Freesound HQ preview MP3s (originals require login), first hit extracted;
audibly clean, precedent: v1.1 kit shipped an MP3-sourced hi-hat.

## Reproducibility

Download + processing scripts from the sourcing session:
`download.sh`, `process.sh` (Virtuosity), `download-sonicpi.sh`, `process-sonicpi.sh`
(Sonic Pi) — archived in the session scratchpad; parameters recorded above suffice to
re-derive the kit.
