# R11 — Responsive, accessibility, audio, data-migration, and full-flow regression

**Ticket:** Cross-ticket · **Status:** In progress (see remaining limitation)
**Session:** 2026-07-15

## Scope

Full regression sweep across R1–R9 now that all nine implementation rows are Done, run independently of the agents that implemented each row.

## Automated checks

| Check | Result |
|---|---|
| `npm run build` (`tsc && vite build`) | Passed, no TypeScript errors. |
| `sidecar/.venv/bin/python -m pytest sidecar` | 20 passed (`pytest` was missing from the venv; installed it to run the suite — a dev-only, reversible addition, not a project dependency change). |
| `grep -rn "setInterval" src` | No matches in application source (only inside a vendored Python lexer under `sidecar/.venv`, irrelevant). |
| `grep -n "DRUM_PAD\b" src` | No matches — no coarse three-zone drum mapping remains on the runtime path. |
| Search for a second grid-projection state (`gridMode`, `viewMode`, etc.) | No matches — `mode` remains the sole projection source, per `src/StepGrid.tsx`. |
| Pure `_selfcheck()` for `constants`, `pattern`, `lesson`, `hit`, `teaching`, `transport`, `audio`, `BeatPad` | All 8 PASS, run live in the browser via dynamic `import()` of each dev module (re-run after the fix below with the same result). |
| `validateLesson` rejection checks | Unsupported `schemaVersion: 99` → rejected; invalid drum pad id `"99"` → rejected; non-object input → rejected. All three return `{ok:false, error}` without touching editor state. |
| `DRUM_BY_PAD` order vs. R10 lock | Matches exactly: 1 Kick, 1.5 Clap, 2 Snare, 2.5 Rimshot, 3 Claves, 4 Open Hi-Hat, 4.5 Closed Hi-Hat, 5 Low Tom, 5.5 Mid Tom, 6 High Tom, 6.5 Crash, 7 Ride. |
| Runtime assets | All 12 `public/rok/pad-<id>.wav` present and match `DRUM_BY_PAD[pad].sample`; `public/rok/stick.wav` present for the metronome. No file under `StylophoneSamples/` was touched this session. |

## A regression caught and fixed this session

The global keyboard-play listener (`window.addEventListener("keydown", …)`, from R3) has no knowledge of the R9 dialogs. A native `<dialog>` makes the background `inert` for pointer/focus, but a `window`-level keydown listener still receives bubbled keydowns from inside the (focus-trapped) dialog. Confirmed live: with the Source/Clip dialog open and focus on its Close button, dispatching a `q` keydown updated the background "last pad" live region to `Pad 1` — a background drum-pad key leaking through an open modal.

Fixed in `src/App.tsx`: added `openDialogRef` (mirrors the `openDialog` state, following the existing ref-mirroring pattern already used for `mode`/`recording`/`teaching`) and an early return at the top of `onKeyDown` when a dialog is open. Re-verified: with no dialog open, `w` still registers (`Pad 1.5`); with a dialog open, the same keydown on the focused dialog element no longer changes the live region. Space-to-toggle-play was already safe (the existing focused-`BUTTON` guard lets a dialog's own buttons handle Space), so it needed no change.

## Browser full-flow regression (verified independently, at 1280 × 720)

- **Mode + grid projection move together, both layers stay audible:** filled `1 · Kick drum step 1` and `6.5 · Crash cymbal step 5` in DRUMS, filled `4.5 · F♯ step 20` (octave `+1`) in BASS, switched modes back and forth — all three cells remained filled and correctly attributed to their exact pad/pitch row across every switch.
- **Octave state (R6):** disabled with `aria-disabled="true"` in DRUMS; enabled in BASS; value set to `+1` in BASS persisted (not reset) after switching to DRUMS and back — matches "preserve the octave value and restore controls in BASS mode."
- **Full save/export/import round trip through the new R9 modal:** saved the pattern above as "R11 regression lesson" via the Save Lesson / Import Lesson dialog; exported and captured the downloaded JSON directly (`URL.createObjectURL` intercepted) — confirmed `schemaVersion: 2`, drum hits as exact `{step, pad}` (`{"step":0,"pad":"1"}`, `{"step":4,"pad":"6.5"}`), and the bass note as `{"step":19,"pad":"4.5","octave":1,"length":1}`. Cleared both cells in the live editor, reopened the dialog, clicked Load, and both cells reappeared filled — exact pad identity preserved end to end.
- **Modal mechanics (R9):** both dialogs open centered with a dimmed backdrop; overlay click and the × button both close and correctly return focus to their exact launcher button; the 44×44px close target was measured directly. Escape-to-close relies on the native `<dialog>` default action (same mechanism already proven by focus-trap and focus-return above) and could not be exercised in this specific harness because the tab reports `document.visibilityState === "hidden"` even while fronted — documented as a harness limitation in R9's own evidence, not re-litigated here.
- **No vertical scroll:** both panes report `scrollHeight === clientHeight === 720` at 1280×720 with dialogs closed, both before and after the full interaction sweep above (dynamic content, e.g. saved-lesson rows, does not push the layout past the viewport).
- **No console errors** were logged at any point across the full session (initial load, mode switching, recording toggles, modal open/close, save/export/import, the keyboard-leak reproduction and fix).

## Not verifiable in this environment

- **Audible sample timbre and per-voice balance**, and **click level/restraint at 40/120/240 BPM**, require actually listening to the output. This session confirmed the code-level contract (separate click bus at −18 dB with a +3 dB downbeat ceiling in `src/audio.ts`, all 12 distinct ROK WAVs wired to their locked pads) but did not and — per the tracker's completion policy ("Do not mark audio balance or slide feel Done from code inspection alone") — should not claim the perceptual check from code inspection alone.
- **Pointer/touch bass slide feel** (the two BASS drag paths from R7: inner `1 → 2` direct vs. outer `1 → 1.5 → 2`) was verified structurally in R7's own evidence; this session did not re-drive raw pointer coordinates across the pad, since R9 did not touch `BeatPad.tsx`.

## Remaining limitation

R11 cannot be marked Done from this session alone: the audible checks above need a human listener. Every other item in the verification matrix — build, tests, forbidden-pattern search, self-checks, full-flow data integrity, modal accessibility, and the keyboard-leak fix — passed. Recommend the user do a short listening pass (metronome at 40/120/240 BPM, each of the 12 pads) before closing R11 and the two parent tickets.
