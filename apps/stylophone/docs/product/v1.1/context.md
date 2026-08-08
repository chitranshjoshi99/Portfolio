# Product context — v1.1

**Product:** A local, grid-first pattern composer and recording guide for the physical Stylophone Beat.
**Status:** ready to build

---

## Co-founder (CF) — 2026-07-15

**Clarity gate:** met (9/10 problems answered cleanly)

**Decisions locked:**
- **v1.1 wedge = grid-to-Beat translation, not a laptop replica.** The physical Beat and stylus own performance; the app owns the editable musical score and makes its unfamiliar pad mapping legible.
- **Primary workflow:** begin with a blank pattern, author it in the grid, then use the grid as a live score while manually recording each part onto the physical Beat. On-screen-pad practice remains a secondary aid.
- **Time model:** retain the Beat's fixed 8-beat loop (two 4-beat cycles), but expand it from 32 to **64 steps** (eight slots per beat).
- **Drum lesson model:** each populated drum row is exactly one guided recording pass. Passes follow the grid's fixed visual order; `Next row` skips empty drum rows. The active row alone receives the accent while the entire grid stays visible.
- **Bass lesson model:** all authored bass content is one final pass, not one pass per pitch row. v1.1 uses 64-step bass notes with snapped multi-step holds; free-float timing is deferred to v1.2.
- **Completion / redo:** progression is deliberate and ungraded: the user presses `Next row` after recording on hardware. Completing the final bass pass offers a restart. Any populated drum row can be reopened for a targeted redo, mirroring independent layer deletion on the Beat.
- **Lesson source:** patterns are authored manually from a blank grid, saved locally, and imported from saved lesson files. Hide the existing song-upload/generation entry point without deleting its code.
- **Deferred:** Electron packaging, PWA/mobile polish, hardware-audio connection/sync, stem separation, and automatic lesson generation do not belong in v1.1.

**Recommendations:**
- Keep hardware state honest: the Beat exposes audio only, not layer/timing data, so v1.1 must not claim to grade or verify physical recording.
- Treat guided passes as a deterministic projection of the pattern, not separately authored/reordered lesson metadata.

**Open risks / unknowns:**
- The most legible grid-first layout and interaction design for 64 columns is unresolved (severity: high) — hand to Design-girl.
- Exact versioned data schema for 64-step drums and snapped bass holds was resolved by Architect (severity: high).
- Whether 64-step resolution makes physical manual recording materially better remains a user-experience assumption to validate with a real Beat (severity: medium).

**For the next persona:**
- Define v1.1's Epic → Story breakdown around the grid composer, persistent patterns, deterministic row-by-row guidance, redo flow, and hiding the generator. Do not reintroduce laptop-performance, auto-generation, packaging, or hardware-sync scope.

---

## Product-head (PH) — 2026-07-15

**Clarity gate:** met (9/10 problems answered cleanly)

**Decisions locked:**
- **Primary user:** a Stylophone Beat owner with a laptop who wants to compose a clear loop and manually build it on the physical device. v1.1 remains a personal/local tool; no account, cloud, collaboration, packaging, or mobile scope.
- **Job to be done:** “Turn my idea into an understandable 8-beat Beat score, then record it on the hardware one part at a time without mental pad translation.”
- **Value moment:** create a valid drums-only, bass-only, or combined pattern from a blank grid; play its row-by-row guide on the Beat; save it for reuse.
- **Grid ↔ pad contract:** grid edits/auditions and playback trigger the mapped sound and pad highlight. The pad is a live translation display and secondary practice aid, not the primary composer.
- **Guided mix state:** active pass is bright and foregrounded; completed passes stay visible/audible as quieter context; unreached content is grey and silent.
- **Persistence boundary:** start fresh with a v1.1-only schema; do not migrate/import 32-step v1 lessons. Retain local save and v1.1 pattern import/export. A saved lesson may contain drums only, bass only, or both.
- **Sound profiles:** store independent pattern-level `drumBank` and `bassBank` values. Changing the bank while its mode is active immediately retimbres every recorded event in that instrument — including its loop — just like the hardware; it does not rewrite event data. Drums and bass may therefore differ (e.g. ROK drums + TEC bass).
- **Preview audio policy:** retain the current 12 ROK pad samples as the reference kit. Derive approximate HIP / TEC / BOX drum previews from those assets through deliberate processing; derive four bass profiles from distinct synth/sample-processing presets. Do not claim these are captured Stylophone sounds or use unverified archive dumps.

**EPIC → STORY spine:**

*EPIC 1 — Grid-first pattern composition*
- S1.1 64-step, fixed 8-beat grid with 12 physical drum-pad rows and a bass projection. Sev Critical · Cx Medium
- S1.2 Grid edits/auditions synchronously translate to the circular pad and audio. Sev Critical · Cx Medium
- S1.3 64-step bass taps with snapped drag-to-extend holds. Sev High · Cx Medium
- S1.4 Independent drum/bass profile selection with immediate full-instrument retimbre. Sev High · Cx Medium

*EPIC 2 — Pattern as a durable local lesson*
- S2.1 New blank v1.1 pattern with a valid drums-only, bass-only, or combined state. Sev Critical · Cx Low
- S2.2 Save, load, and import/export the v1.1 pattern schema; clearly reject legacy format. Sev High · Cx Medium
- S2.3 Hide song upload/generation from the active product surface without deleting its code. Sev Medium · Cx Low

*EPIC 3 — Hardware companion guidance*
- S3.1 Derive the guided pass order from populated drum rows in visual order, then optional bass. Sev Critical · Cx Medium
- S3.2 Explicit `Next row`, restart-after-completion, and row-targeted redo. Sev Critical · Cx Medium
- S3.3 Active/passed/unreached visual and audio states; never claim physical-play verification. Sev High · Cx Medium

*EPIC 4 — Grid-first workspace polish*
- S4.1 Reframe the desktop workspace around the grid while retaining the pad as a synchronized translator. Sev Critical · Cx High
- S4.2 Make 64-column timing readable during live hardware recording. Sev High · Cx High

**Recommendations:**
- Keep the circular pad interactive for audition/practice, but never allow it to compete visually with the grid’s authoring and hardware-guide role.
- The bank selector must visibly communicate the active instrument it affects; a single selector is acceptable only when mode ownership is unambiguous.

**Open risks / unknowns:**
- Whether dragged bass-note holds remain clear in the 64-column grid needs a visual interaction model (severity: medium) — hand to Design-girl and Architect.
- Derived HIP / TEC / BOX previews must be distinct enough to be useful without claiming hardware fidelity (severity: medium) — validate by listening before locking.
- Exact grid-first desktop layout, 64-step readability, and guidance states are unresolved (severity: critical) — hand to Design-girl.

**For the next persona:**
- Design the grid-first desktop experience. Preserve its fixed 8-beat / 64-step structure, live pad translator, mode-owned bank selector, and the active/passed/unreached guidance hierarchy. Do not solve it by hiding the grid or re-elevating laptop pad performance.

---

## Design-girl (DG) — 2026-07-15

**Clarity gate:** met (9/10 problems answered cleanly)

**Decisions locked:**
- **Workspace hierarchy:** invert v1's equal-pane composition. The 64-step grid is the dominant score surface; the circular pad is compact, always-visible, and a synchronized translator/practice aid.
- **Full-loop visibility:** desktop default shows all 64 steps of the fixed 8-beat loop at once, grouped into two clearly separated 32-step / four-beat cycles. Do not require horizontal movement during hardware recording.
- **Header:** a compact status strip contains concise information (`BPM · active instrument / profile · pass n/total`), tempo control, quiet branding, and the eight metronome dots. Do not put active-row identification in the header.
- **Active-row location:** show the current lesson target in its actual grid row label and row treatment; it must not compete with transport information elsewhere.
- **Controls:** replace the oversized lesson-control panel with a compact action strip: one adaptive lesson action (`Start lesson` → `Next row` → `Restart`), reset, import/export, and cue controls. Group mode, profile, conditional bass octave, click, play/stop, and REC in one mode-aware control rail.
- **Pad REC role:** retain it as an explicitly secondary `pad → grid` capture tool for composing/practising. Arming REC makes the receiving row and mode unmistakable. It is not hardware recording.
- **Interaction states:** Compose permits grid editing and pad REC. Guided play locks editing and disables app REC. Pausing a guided lesson unlocks editing with an explicit paused state; **any edit restarts the lesson from the beginning** rather than preserving stale pass progress.
- **Guidance hierarchy:** active pass = brightest/foreground audio; completed passes = dimmer and quieter backing context; unreached passes = grey and silent. This hierarchy always appears in the grid itself.

**Recommendations:**
- Keep utilities compact and out of the score’s visual path; import/export is never a hero action.
- At supported desktop widths, protect the 64-column cell geometry rather than compressing it below a usable click target. The app is desktop-first in v1.1.

**Open risks / unknowns:**
- Extended, snapped bass holds need an intelligible representation inside the same 64-column score (severity: medium) — hand to Architect.
- Final dimensions, font scale, and exact responsive floor need visual QA against the target MacBook viewport (severity: medium).

**For the next persona:**
- Define the smallest viable versioned data model and scheduling boundaries for 64-step drum events, snapped bass holds, independent instrument banks, deterministic lesson derivation, and restart-on-edit. Preserve the design states above.

---

## Architect (ARCH) — 2026-07-15

**Clarity gate:** met (9/10 problems answered cleanly)

**Decisions locked:**
- **Stack holds:** React + TypeScript + Tone.js/Web Audio; local browser storage; no service, account, sidecar, or deployment work in v1.1.
- **One pattern source of truth:** persist only the pattern. Guided pass order, pass state, pad translation, audio selection, and visual row state are derived views; never persist separate lesson/layer-order metadata.
- **Schema boundary:** write a fresh, versioned v1.1 schema and reject older lesson schemas. Do not build a migrator.
- **Timebase:** fixed 8-beat / two-bar loop with exactly 64 slots. Transport, drum scheduling, grid playhead, and bass timing share this one source of time.
- **Drum data:** `Record<PadId, boolean[64]>`; pad identity remains exact through editing, playback, grid projection, and guidance.
- **Bass v1.1:** discrete 64-step notes `{ step, pad, octave, length }`. Dragging extends a snapped note over multiple steps; no overlapping notes. **Free-float timing, continuous pitch trajectories, and unsnapped input are deferred to v1.2.**
- **Banks:** `drumBank` and `bassBank` are independent, pattern-level values. Events store no bank. Changing a mode's bank switches the runtime sample/synth lookup for that instrument's full existing and future loop immediately.
- **Guidance reducer:** derive populated drum pads in the fixed visible pad order, then append bass only when it contains notes. `Next row`, targeted redo, and mix-state selectors operate on that derived sequence. Any edit resets guidance to its initial state.
- **Audio boundary:** retain ROK as reference assets and generate/derive approximate HIP / TEC / BOX previews behind the same `{bank, pad} → voice` interface. Do not connect v1.1 to external hardware audio or unverified external sample packs.

**Load-bearing decisions:**
1. **Pattern-only persistence** — removes duplicate state and makes deterministic guidance/restart correct by construction.
2. **64 discrete slots, not free time** — allows a legible full-loop grid and one reliable Tone transport schedule.
3. **Mode-owned bank values, not per-event banks** — matches the physical device’s retimbre behavior and avoids needless schema complexity.

**Complexity adjustments:**
- 64-step grid + transport: **Medium** (the current 32-step path is a contained upgrade).
- Bass drag-to-extend: **Medium** (bounded, snapped interval editing).
- Independent derived banks: **Medium** (audio interface + state, no new infrastructure).
- Derived guided sequence / restart-on-edit: **Low–Medium** (pure selectors plus explicit UI state).
- Free-float bass: **deferred to v1.2**; it would otherwise be High complexity.

**Recommendations:**
- Retain one canonical `stepDuration` computation used by rendering, event editing, playhead, and audio; do not scatter 64-based arithmetic.
- Treat generated profile audio as a replaceable adapter, so hardware samples can be supplied later without a schema/UI change.

**Open risks / unknowns:**
- Profile previews must be auditioned against the user’s expectations; technical validity alone cannot establish musical usefulness (severity: medium).
- Existing `localStorage` keys need deliberate v1.1 namespacing so legacy data is neither silently loaded nor destroyed (severity: medium).

**For the next persona:**
- Reduce this to the smallest build sequence. Reuse the current transport, pad geometry, grid, and ROK assets where they fit; cut anything not required for the grid-first pattern-to-hardware workflow.

---

## Tech-bro (TB) — 2026-07-15

**Clarity gate:** met (9/10 problems answered cleanly)

**Decisions locked:**
- **No new sample downloads or static banks.** Keep the current 12 ROK samples and create a compact runtime bank map: ROK unchanged; HIP warmer/low-fi; TEC brighter/tighter; BOX aggressively filtered/percussive. The map keys off the existing exact pad identity and is replaceable when better assets exist.
- **No profile editor, mixer, sample browser, waveform view, cloud, library catalogue, presets, or hardware integration.** None advances the grid-to-hardware job in v1.1.
- **No lesson entity/framework.** A pure `derivePasses(pattern)` selector is sufficient; reuse existing React state and Tone transport rather than introducing a state machine library.
- **Persistence is intentionally one-slot.** Save the current v1.1 pattern locally as a draft; export named JSON for durable patterns; import JSON replaces the current draft after validation/confirmation. A multi-pattern local library and preset catalogue are v1.2.
- **Reuse over replace:** adapt the current pad, transport, grid, recorder, local persistence, and import/export components. Hide generator/source UI; do not delete it or refactor the sidecar.

**Lean build order:**
1. Fresh v1.1 pattern schema, 64-slot helpers, and legacy rejection.
2. 64-step transport/grid plus snapped bass drag-length editing.
3. Derived drum/bass bank audio adapter and pad/grid translation.
4. Derived guided-pass reducer with restart-on-edit.
5. Grid-first layout and compact controls.
6. Browser-level functional and audible UAT; validate imports and preservation across reload.

**Buy / borrow:**
- Tone.js for all scheduling and audio routing — no custom clock.
- Browser `localStorage`, `Blob`, and file input for one draft plus export/import — no database, IndexedDB, or file-system API.
- Existing CSS/React — no new state, UI, or audio dependency.

**Deliberate cuts (revisit in v1.2+):**
- Free-float bass, pattern library/preset packs, mobile/PWA/Electron packaging, song upload/reduction, hardware audio sync, exact hardware profile captures, scoring/verification, and collaboration.

**For the next persona:**
- Confirm the local import/export and generated-audio boundaries are safe enough for this single-user release; flag only concrete controls that prevent data loss or unsafe file handling.

---

## Security-master (SM) — 2026-07-15

**Clarity gate:** met (9/10 problems answered cleanly)

**Threat model:**
- v1.1 has no network service, account, payment, PII, credential, or hardware-input surface. The only untrusted input is an imported pattern JSON file; the only meaningful asset at risk is the user’s current local draft.

**Decisions locked:**
- **Import is a strict trust boundary.** Read as text; enforce a small file-size limit; parse inside `try/catch`; validate the complete v1.1 schema, enums, numeric bounds, 64-step array lengths, note non-overlap, and pattern title length before touching React state or `localStorage`.
- **Atomic replacement:** validate into a new object first. Only after it is valid may import replace the current draft. Never partially mutate the active pattern.
- **Data-loss guard:** if the current draft has unsaved changes, require an explicit replace confirmation before import/reset/new-pattern. Export is always available before destructive replacement.
- **No active generator service:** hide the generator UI and do not start/expose its sidecar or upload endpoint in v1.1. Retaining its source code in the repository is not authorization to accept untrusted files at runtime.
- **No secrets:** the client ships no tokens or credentials. Pattern titles/labels render as text only; never inject imported strings as HTML.

**Residual risks:**
- Browser/local-storage clearing can delete the one-slot draft (severity: medium). Mitigation: explicit JSON export is the durable save path; communicate that in save UI.
- A locally modified build could still inspect local data (severity: low); out of scope for a personal, no-account tool.

**For the next persona:**
- No deployment hardening is needed while v1.1 remains local/browser-only. Verify that the dev/server workflow does not accidentally expose the deferred sidecar; otherwise the product is ready for document generation after a final scope pass.

---
