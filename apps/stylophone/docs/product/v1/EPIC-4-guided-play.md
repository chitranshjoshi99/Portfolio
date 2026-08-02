# EPIC 4: Guided Play-Along

The pedagogy layer that makes this a *learning* app, not a player. A lesson is taught **one layer at a time** — practice drums until you've got it, then bass joins the mix — with real-time cues that show which pad to hit on which beat, synced to the click. This is the feature that, combined with upload, makes the whole product worth using.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|-----------|----------|
| 4.1 | As the learner, I want a lesson taught one layer at a time (drums → bass), with completed layers still playing underneath, so I build a groove like a musician. | Critical | Medium | 11 |
| 4.2 | As the learner, I want real-time cues on the grid and pad (which pad, which beat) synced to the click so I learn the timing. | Critical | High | 12 |
| 4.3 | As the learner, I want to see whether my on-screen taps land in time so I know I'm improving. | Medium | Low | 13 |

> Severity & complexity are business/conceptual.

## Locked decisions

See [README](README.md). Epic-specific:

- **Teaching order = `lesson.teachOrder`** (default `["drums","bass"]`). One active layer at a time; completed layers keep sounding.
- **State encoded by Anthropic-orange brightness:** completed layer = dim/muted orange (audible underneath), active layer = bright orange, "hit-now" = brightest + motion/shape.
- **Default cue = grid-cursor + pad-echo:** the grid pane's playhead carries *time*; the pad wedge echoes the *gesture* (lights the target in sync). **Alt cue = pulse-head** (target wedge pulses ahead of the beat) — user-switchable.
- **No hardware sync.** The on-screen replica is the practice + feedback surface; the physical Beat is the destination. The replica deliberately does not auto-snap timing — the grid is the teaching aid.
- **Feedback = trimmed to hit/miss** (green on hit inside the step window, nothing on miss). No scoring/streaks/accuracy-% in v1.
- **a11y:** cues never rely on color alone (hue + motion + shape); honor reduced-motion (swap sweeping motion for flash/scale).

## Execution instructions (priority order)

### 1. Layered teaching model — S4.1 (Priority 11)
- **Goal:** step through a lesson layer by layer; completed layers keep playing while the current one is practiced.
- **API contract (state):** `startLesson(lesson)`, `currentLayer`, `completeLayer()` → advance `teachOrder`, `activeLayers` (completed + current). Playback mixes completed layers + click; the active layer is the one being cued.
- **Key decisions:** a layer "stack" UI (Drums → Bass …) showing depth and state via orange brightness. "Complete/next" is user-driven in v1 (they decide when they've got it) — auto-advance on accuracy is v2.
- **Acceptance:** starting a lesson cues the first layer with the click; advancing keeps the previous layer playing (dim) and cues the next (bright); the mix audibly thickens as layers stack.

### 2. Real-time cue engine — S4.2 (Priority 12)
- **Goal:** show which pad to hit on which beat, in time with the click, for the active layer.
- **API contract:** driven by Tone.Transport time (sample-accurate) — for each upcoming hit in the active layer, drive a grid-cursor position + light the target pad wedge at the right transport time.
- **Key decisions:** schedule cues via Tone.Draw/Transport lookahead (do NOT poll with `setInterval`). Default grid-cursor + pad-echo; provide a toggle to pulse-head. Cue = orange brightness + a ring/shape + motion (respect reduced-motion). Look-ahead so the cue appears slightly before the beat.
- **Acceptance:** during playback the grid playhead and the lit pad wedge stay locked to the click across a 60s loop with no drift; switching cue style works; reduced-motion swaps to a non-sweeping cue; the cues correctly reflect the active layer's pattern.

### 3. Hit/miss highlight — S4.3 (Priority 13)
- **Goal:** immediate visual confirmation when the learner's on-screen tap lands in the target window.
- **API contract:** on pad tap during a lesson, compare tap transport-time to the nearest active-layer target within a tolerance window → hit or miss.
- **Key decisions:** flash the wedge green on a hit inside the window; nothing on miss. Tolerance = a fixed step-window (tune to feel). No score kept.
- **Acceptance:** tapping the right pad near the beat flashes green; tapping off-beat or the wrong pad does not; the check uses transport time (not wall-clock) so it stays honest at any BPM.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 4.1 | Layered teaching model | Done | S5 | Pure `teaching.ts` seam (activeLayers/currentLayer/layerState) — imported by 4.2/4.3. App gates existing `onStepAudio` via `activeLayersRef` (null=free-edit full mix; teaching=completed+current), no new scheduler. `teaching:{index}\|null`; `startLesson`/`nextLayer`/`exitLesson`. LayerStack UI: state = orange brightness + word (done/now/locked) + dot shape (not hue-alone). StepGrid `dimmedLanes` dims not-yet-active lanes (static opacity). teachOrder hardcoded to v1 default (ponytail note). Browser-verified on prod build: start cues drums only; advancing keeps drums (dim) + cues bass (bright), mix thickens; finish→free-edit. No setInterval, no console errors, build clean. |
| 4.2 | Real-time cue engine | Done | S5 | New `transport.scheduleDraw`+`CUE_LEAD` (Tone.Draw wrapper, no new scheduler). App 2nd `onStepAudio` cue: current-layer target pad (bass→note.pad, drums→DRUM_PAD[first sound]) lit at time−CUE_LEAD, cleared +0.12s + on exit/stop. BeatPad `cuedPad`/`cueStyle`: brightness + 3px ring + pulse keyframe, reduced-motion keeps static glow. Echo/Pulse toggle in LayerStack. Grid-cursor = existing playhead. Browser-verified prod build: drums cue wedge 2.5 locked to click (1 wedge), Echo↔Pulse switches, advance→cue follows bass pad, STOP clears, no drift/console errors, no setInterval. |
| 4.3 | Hit/miss highlight | Done | S5 | Pure `hit.ts` (nearestStepDistance/isHit + selfcheck, circular wraparound) + `transport.currentStep16()` (Transport-time, BPM-honest). App handlePad flashes the wedge GREEN when a tap lands within HIT_TOL=1.5 steps of a current-layer target (drums→padDrum lane, bass→exact pad); miss = nothing. `--hit #3fb950` + 3px ring + pad-hit-flash, reduced-motion static, is-hit overrides orange cue. ponytail: 350ms cosmetic clear timer (UI only). Browser-verified prod build: kick-zone tap on filled lane → green; empty/wrong pad → none; STOP → none; no console errors. |

> Status ∈ {Not started, In progress, Blocked, Done}.
