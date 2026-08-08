# EPIC 1: The Instrument

A playable, stealth-styled on-screen replica of the Stylophone Beat, paired with a synced 32-step grid. This is the foundation surface and the app's home — usable standalone to free-play or build a loop by hand, before any lesson exists. It must feel like the real device (same pad, same numbering, same click), but remastered for clarity.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|-----------|----------|
| 1.1 | As the player, I want an on-screen Beat replica (circular pad w/ native numbering, tempo knob, CLICK/PLAY/REC, mode/sound switches, grille info display) so it feels like my real device. | High | Medium | 2 |
| 1.2 | As the player, I want to tap the pad and instantly hear the mapped ROK drum/bass sound so the replica is a real instrument. | Critical | Medium | 3 |
| 1.3 | As the player, I want a faithful metronome/click, an 8-beat loop transport, and a visible BPM readout so I can keep time. | High | Medium | 4 |
| 1.4 | As the player, I want a 32-step grid that stays synced to the pad and click so I can see the structure I'm playing. | Critical | Medium | 5 |
| 1.5 | As the player, I want bass across 5 octaves with a simple octave control so basslines aren't range-limited. | Medium | Medium | 6 |
| 1.6 | As the player, I want a responsive two-pane layout and accessible controls so it works on desktop now and mobile later, for everyone. | High | Medium | 7 |

> Severity & complexity are business/conceptual. Dev effort ignored.

## Locked decisions

See [README](README.md) for product-wide locks. Epic-specific:

- **Tone.js owns all timing.** Transport, click, loop, and later cue scheduling. Do not build a custom audio clock or `setInterval`-based sequencer.
- **Pad geometry is fixed:** circular pad, 12 pitch positions in native numbering **1, 1.5, 2, 2.5, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7** (half-steps skip where a piano has no black key — no 3.5, no 7.5). These map to one chromatic octave (1=C, 1.5=C#, 2=D, … 3=E, 4=F, …). Drums are on/off hits on the pad; bass/melodic use pitch.
- **Loop = 8 beats (4/4, 2 bars).** Grid = **32 steps** (16th-note resolution), 16 per bar. `step` index 0–31. Loop length stays faithful to the device (8 beats); resolution is fine enough for 16th-note hats (HIP/TEC banks).
- **Sound = ROK bank only**, sampled from hardware, loaded as static one-shot samples (kick, snare, hat, + bass note(s) pitch-shifted across octaves).
- **Stealth theme, Anthropic-orange single accent, brightness = state.** Speaker grille = info display (BPM now).
- **Home is this instrument.** It must be fully functional with zero lessons loaded.

## Execution instructions (priority order)

### 1. Beat replica shell — S1.1 (Priority 2)
- **Goal:** the static, styled, interactive replica renders and responds to clicks (no sound yet needed to pass layout, but wire click handlers).
- **Data model:** none persisted. Local component state: `selectedSound` (drums/bass mode is cosmetic in v1 since ROK only — keep a mode toggle for parity), `bpm`.
- **Key decisions:** SVG for the circular pad (precise wedge geometry + hit regions + labels). Tempo knob is a rotary control whose angle reflects BPM; grille shows BPM number. CLICK/PLAY/REC as styled buttons. Mode (DRUMS/BASS) + sound-bank (ROK/… disabled) switches present for fidelity.
- **Acceptance:** all controls visible in stealth theme; tapping a pad wedge fires a handler with the correct pad id (e.g. `"1.5"`); knob turns and updates the grille BPM number; keyboard focus reaches every control.

### 2. Audio engine — S1.2 (Priority 3)
- **Goal:** tapping a pad plays the correct ROK sample with low latency.
- **API contract:** `playPad(padId, {mode})` → triggers a Tone.Sampler/Player voice. Audio context resumes on first user gesture (iOS requirement).
- **Data model:** a static sample map: `{ kick, snare, hat }` for drums; bass = one (or few) sampled notes pitch-shifted to the 12 pad positions × octave.
- **Key decisions:** Tone.js `Sampler` for bass (pitch-shift from a root sample), `Player`/`Players` for one-shot drums. Preload + decode on app start behind the first gesture.
- **Acceptance:** tapping drum pads plays kick/snare/hat; tapping bass pads plays the right pitch; perceptible latency < ~30ms; no audio-context errors on iOS Safari (tap-to-start handled).

### 3. Metronome + loop transport — S1.3 (Priority 4)
- **Goal:** a click identical in feel to the device, an 8-beat loop, PLAY/stop, and a live BPM readout.
- **API contract:** `transport.start()/stop()`, `setBpm(n)`. Loop length = 8 beats; click accents "1" of each bar ("1234 2234").
- **Key decisions:** Tone.Transport with `loop` over 8 beats; click via a metronome sample or Tone.Synth blip. BPM from the knob; grille displays it. REC in v1 = start capturing pad taps into the current pattern (feeds S3.1 authoring) — minimal: record taps quantized to nearest of 32 steps.
- **Acceptance:** PLAY starts a looping click at the set BPM; changing the knob changes tempo live; the "1" accent lands correctly; BPM readout matches.

### 4. 32-step grid visualizer — S1.4 (Priority 5)
- **Goal:** a 32-step grid (2 bars × 16, 16th-note resolution) that shows the current pattern and a playhead sweeping in sync with the click.
- **Key decisions:** grid is the "structure" pane (desktop-right / mobile-default). Rows = layers (drums as kick/snare/hat lanes; bass as a note lane). Playhead position driven by Tone.Transport time, not a separate timer (stay sample-accurate). Tapping a grid cell toggles/sets a hit (shared edit surface with S3.1).
- **Acceptance:** playing the loop sweeps the playhead across 32 cells in time with the click; a hit placed on the pad appears on the grid and vice versa; playhead never drifts from the click over a 60s loop.

### 5. Bass octave — S1.5 (Priority 6)
- **Goal:** bass spans 5 octaves (−2..+2) and is playable/selectable.
- **Key decisions:** octave lives in the note data (`octave` −2..+2). v1 input = a **plain octave control** (up/down buttons or a small drag control) — the authentic swipe-across-the-7↔1-seam gesture is v1.1. Pitch playback = root sample transposed by (pad semitone + octave×12).
- **Acceptance:** shifting octave changes the bass pitch by an octave and is reflected in stored note data; range clamps to ±2.

### 6. Responsive layout + a11y baseline — S1.6 (Priority 7)
- **Goal:** desktop two-pane (replica left, grid right); layout collapses cleanly toward single-pane so mobile is later config; accessibility baseline met.
- **Key decisions:** CSS grid with a breakpoint that stacks/switches panes. a11y: keyboard play (map pad + transport to keys), reduced-motion media query (calmer cues), AA contrast, ≥44px targets, cues carry shape+motion not color alone.
- **Acceptance:** at desktop width both panes show side by side; at narrow width it degrades to a single pane without breaking; keyboard can play pads and toggle transport; `prefers-reduced-motion` swaps to a non-animated cue; contrast checks pass.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1.1 | Beat replica shell | Done | S2 | Vite+React+TS scaffold + stealth two-pane shell. SVG 12-wedge pad (native numbering, fires padId, orange active), rotary tempo knob (drag+arrows, clamp 40–240) + grille BPM display, CLICK/PLAY/REC (stubbed) + MODE radiogroup + ROK bank (HIP/TEC disabled). All controls keyboard-focusable. No audio/transport (1.2/1.3). Browser-verified. |
| 1.2 | Audio engine (ROK) | Done | S2 | Tone.js: Player×3 (kick/snare/hat) + Sampler (bass C2 root, transposed by pad semitone+octave). `playPad(padId,{mode,octave})`; `startAudio()` on first gesture (iOS). No Transport/setInterval. **ASSET CAVEAT:** no hardware ROK samples → synthesized ROK-style kit (`scripts/make_rok.py`→`public/rok/*.wav`), drop-in swap for real samples (pre-publish TODO). Browser-verified: context runs, wavs 200, drums+bass error-free. |
| 1.3 | Metronome + loop transport | Done | S2 | `src/transport.ts` wraps Tone.Transport: 8-beat loop, accented click (beats 0&4), start/stop/setBpm/isPlaying/onBeat + setClickEnabled. App: PLAY/STOP, live-BPM effect, 8-dot beat indicator (Tone.Draw, downbeats ringed), REC visual toggle. No setInterval. Browser-verified: loop wraps, indicator sweeps, BPM live 120→140, STOP resets. |
| 1.4 | 32-step grid visualizer | Done | S3 | 4-lane × 32-step grid (structure pane). Playhead via new `transport.onStep` (16n `scheduleRepeat` + Tone.Draw, 0..31) — no timer. `src/pattern.ts` in-memory Pattern + immutable helpers, shaped to map onto the Lesson-schema layers (seam for 3.1/3.2). `StepGrid.tsx`: labeled `<button>` cells (aria-pressed), playhead outline (non-color cue), beat groups + bar-2 divider. Cell click toggles + plays ROK sound. Pad↔grid: PLAY+REC captures pad taps at the current step (drums→padDrum lane, bass→note); REC off = sound only. Browser-verified: monotonic sweep, kick taps→steps 17/20/28/31, REC-off no capture, no drift, no console errors. `npm run build` passes. |
| 1.5 | Bass 5-octave + control | Done | S3 | Octave state −2..+2 + plain −/readout/+ stepper (TransportControls, reuses `.tbtn`; real buttons disable at ends; swipe gesture = v1.1). `clampOctave` in constants (single clamp source + selfcheck). Live octave into all bass paths (pad play, REC capture, grid `setBass` BassCell.octave); drums unaffected. Pitch via `bassNote` (root + octave×12, unit-checked). Browser-verified: +0→+2 (up disabled)→−2 (down disabled), no console errors. `npm run build` passes. |
| 1.6 | Responsive layout + a11y | Done | S3 | Two-pane grid collapses to single pane ≤820px (no overflow). ≥44px `.tbtn` targets; 24px grid-cell AA min (density exception); reduced-motion pulse cue + `@media reduce` static fallback; `--text-dim` AA (6.5:1/5.6:1); non-color playhead outline kept. Keyboard play: `qwertyuiop[]`→pads via `handlePad` (once-registered listener + refs, guards repeat/modifier/typing), Space→play/stop (yields to focused controls, no scroll) + visible hint. Verified on the production build (dev HMR module-dup quirk — prod correct). `npm run build` passes. |

> Status ∈ {Not started, In progress, Blocked, Done}.
