# Product context — v1.3

**Product:** Beats Drum Machine Coach — next cycle after v1.2 (deployed live for self-testing on chitransh.dev). v1.3 is a **usability/refinement cycle**: the core authoring interaction and touch experience are painful to use. No new product surface — make the existing app actually usable.
**Status:** design locked; tech-bro + generate pending
**Intent (from CF thread):** treat as a **real product**, not just a portfolio piece. User/launch/front-door/positioning explicitly **deferred to a separate session** — do not scope them here.

---

## Co-founder (CF) — 2026-07-17

**Clarity gate:** n/a — user redirected before gate. Direction thread parked by user.

**Decisions locked:**
- v1.3 intent = **real product** (user's call), but this session refines the *experience for the builder himself* first ("I'm struggling to use it, let alone anyone else").
- **No-hardware users are NOT thrown away** — the visualizer pad plays all sounds and is functional/refined. Value does not require owning a Stylophone Beat. (Corrects CF's initial "hardware-gated" framing.)

**Deferred by user (separate session):** target user, TAM, launch, front door / route home, positioning vs. browser-drum-machine incumbents.

**Open risks / unknowns (parked, not resolved):**
- Front door: product still lives at `chitransh.dev/apps/stylophone-visualiser` — the **"Stylophone" trademark v1.2 removed is still in the public URL slug**. Legal + positioning risk. (severity: med) — deferred.
- Triple naming: header "Beats Drum Machine Coach" vs docs "Stylo Drum Machine Coach" vs URL "stylophone-visualiser". (severity: low) — deferred.

**For the next persona:** session is scoped to interaction/UX defects only. Everything else parked.

---

## Design-girl (DG) — 2026-07-17

**Clarity gate:** met — problem sharply defined by user; full defect inventory closed (hover, timing, scroll, dual-audio).

**Core problem:** the app's primary action is *printing grooves into a 12×64 grid*, and it's the worst interaction in the app. Mouse authoring has two distinct costs — **precision** (768 tiny ~24px targets) and **repetition** (a 4-on-floor = 8 identical clicks). App was built **mouse-first; touch was never first-class.**

**Decisions locked (v1.3 design scope):**

*A. Make printing grooves easy (primary fix)*
- **A1 · Drag-to-paint** — press+sweep across a row paints a run; the **first cell touched decides on/off** direction (start empty → paint on; start lit → erase). Single click still toggles one cell. Kills precision + repetition cost.
- **A2 · Per-row quick-fill** — chips on each row label: `×2 · ×4 · ×8 · offbeat · backbeat · clear`. Regular groove = one tap.
- **A3 · Duplicate bar 1 → bar 2** — one button; halves work on repeating loops.
- A1 & A2 are **coexistent, no mode switch** (user confirmed). A mode toggle rejected as cognitive tax.

*B. Touch hardening (make touch first-class)*
- **B1 · Hover persistence** (sticky `:hover` after tap) → **systemic fix: gate every hover style behind `@media (hover: hover)`.** Root-cause, not per-element whack-a-mole.
- **B2 · Scroll hijack** on grid swipe → grid drag **claims the gesture** (paint) via `touch-action`; page scroll stays intact elsewhere. This is the real reason touch felt broken; no paint-vs-fill mode needed.
- **B3 · Timing** → user reports tap-record hits land **scattered (early/late), not consistently late** → fix = **round each tap to the NEAREST step boundary** (nearest-snap). Optional small fixed latency offset only if systematic bias appears on top of scatter.
- **B4 · Dual audio** → on an on-beat tap coinciding with an existing lit step, **two audio sources stack** (sequencer playback + live tap feedback) → doubled sound. This makes feedback **inverted**: correct timing sounds messier than wrong timing. **Requirement (non-negotiable): one step-instant = one sound; on-beat sounds clean.** Fix = single-source **idempotent trigger per (row, step, pass)**. Which source wins is tech-bro's call.

*C. Pad practice (restore + enhance)*
- **C1 · Restore green-on-correct-hit** lesson practice on the visualizer pad (regressed feature — pad segment lights green when hit in time). No-hardware practice path.
- **C2 · Enhance touch:** bigger pad segment targets, next-target indicator, explicit **wrong/late** state (not just green-or-nothing), haptic (`navigator.vibrate`).

**The spine (key architectural insight):** there is **one tap→timing pipeline**, and three riders sit on it — record-into-grid, green-scoring (C1), and single-source audio (B4). B3's nearest-snap + tolerance window serve all of them. **Fix the pipeline once; do not patch three places.**

**Accessibility must-haves:** hover-gating (B1), larger touch targets (C2, A1), explicit interaction states (C2).

**Open risks / unknowns:**
- Timing tolerance **window size** for green-scoring undecided — too tight = unwinnable on touch, too loose = meaningless. Needs a tuned value + probably a calibration knob (severity: med).
- C1 was working before and regressed — **find where/why it was dropped** before rebuilding, or it regresses again (severity: low-med).

**For the next persona (tech-bro):** lock the laziest build for A1–A3, B1–B4, C1–C2, plus the shared tap→timing pipeline module. Reuse existing React state + CSS transitions — CF/prior cycles already ruled out new tour/animation libs; expect no new deps here either. Confirm current file structure and where the record/audio/pad-timing code lives before scoping.

---

## Tech-bro (TB) — 2026-07-17

**Clarity gate:** met — read the code before scoping; most of the cycle is reuse.

**Key findings from the code (grounding the lazy build):**
- **A1 drag-paint**: `StepGrid.tsx` already has full pointer-drag machinery (`startBassDrag`/`extendBassDrag`/`endBassDrag`, `cellStepAtPoint` via `elementFromPoint`, `setPointerCapture`), fenced to bass-length dragging (`if (!bass) return`). Drum paint = **generalize it**, not rebuild.
- **B1 hover**: exactly **6 `:hover` rules** in `src/**/*.css`, **0 guarded**. Wrap in `@media (hover: hover)`. CSS-only.
- **B3 nearest-snap**: `captureStep()` uses `Math.floor(currentStep16())` / `stepRef.current` (current playhead) → change to `Math.round(...)`, route both drum + bass through the one `captureStep()`.
- **B4 dual audio**: `handleDrumPad` calls `playDrum` directly AND the sequencer plays the same step → stack.
- **C1 green**: `is-guide-hit/miss` pass-state plumbing survives in `StepGrid` + `guidance.ts` (commit `3d572cb`); pad-side green regressed — find the removal commit before rebuilding.

**Decisions locked:**
- **THE SPINE (refined by user, cleaner than TB's first take):** `engine.triggerStep(step)` in `transport.ts` is the **only** sound source. Pad + keyboard + sequencer all route through it. **At most one trigger per (step, tick)** — dedup guard is **local to `triggerStep`** (all sound funnels through one function), no cross-subsystem ledger. **Record mode is orthogonal to sound — it only decides persistence** (write-to-grid vs transient). Practice = record OFF + scoring, falls out for free (matched tap = same (step,tick) = one sound; miss = two separated = correct feedback). Feel preserved in jam/stopped mode (no competing tick → fires immediately). This DELETES the dual-audio bug class by construction and shrinks B4.
- **Build-time knob:** on live-signal vs sequencer-tick collision → default **earliest-wins** (hear your tap), flippable to sequencer-authoritative; tune at build.
- **No new dependencies** — native Pointer Events, `touch-action`, `@media (hover: hover)`, `navigator.vibrate`; reuse in-repo drag/guidance.
- **A3 dup-bar** defaulted: lowest priority, ships last, droppable.
- **Locked folder placement** → see `README.md` tree.

**Open risks / unknowns:**
- Timing **window size** for green-scoring still untuned (severity: med) — start at nearest-snap boundary, expose one constant.
- C1 regression: must find the removing commit or it regresses again (severity: low-med).
- Earliest-wins vs sequencer-authoritative is a feel call that needs real-play tuning (severity: low).

**For the next persona / build:** docs generated (4 EPICs + README + execute). **Run pre-build audit (`/kimchi audit`) before any code** — the spine is a real architecture change worth a second look. Then `execute.md` drives the autonomous build in priority order.

---
