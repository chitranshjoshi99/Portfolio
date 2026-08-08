# EPIC 4: Grid-first workspace

Make the interface feel like a score and hardware companion, not a laptop imitation of the Beat. The workspace must keep the complete loop visible while making the circular pad useful but subordinate.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a desktop Beat owner composing or following a row-by-row lesson, I want one grid-first workstation that keeps the complete 64-step score, live status, compact controls, lesson actions, and synchronized visualizer pad in one deliberate hierarchy, so that I can author or perform the loop without scanning between unrelated panes or losing my place. | Critical | High | 10 |
| 2 | As a Beat owner, I want compact mode-aware controls and a secondary pad recorder so that I can compose without mistaking the app for hardware sync. | High | Medium | 11 |
| 3 | As a Beat owner, I want accessible states and verified desktop behavior so that the score remains usable in a live recording moment. | High | Medium | 12 |

## Story 1 — Single-chassis grid-first workstation

### User outcome

The app should read as a score and hardware companion at first glance. The grid is the authoring surface and the hero product. The circular pad is a synchronized visual translator and an optional practice/recording window, not a competing instrument panel. Every persistent control must have an obvious home in the same chassis; a user should not have to search a separate vertical sidebar to move between composing, listening, and lesson progression.

### Layout contract

Implement one desktop chassis with three horizontal bands. Do not implement the workspace as a permanent wide `Structure` pane beside a narrow `Instrument` pane.

1. **Top status band — full chassis width**
   - Left: a compact info display containing BPM, active instrument, and the selected profile for that instrument.
   - Near-left: the tempo control, visually distinct from the status text but not larger than the grid’s row-label rail.
   - Centre: quiet Stylophone Beat Coach branding; branding must not consume the primary interaction area.
   - Right: eight metronome dots plus the lesson pass count/status. The active row name remains on the grid row label; the header carries only orientation and progress context.
   - The band must remain readable at 1280×720 without wrapping, clipping, or pushing the grid below the viewport.

2. **Score band — dominant middle surface**
   - The score spans the usable chassis width below the header and above the action deck. It must not share a persistent narrow side rail with the pad or transport controls.
   - All 64 columns are visible together at the supported desktop floor of 1280×720. No horizontal scrolling, hidden columns, compressed-away labels, or second grid view is allowed.
   - Keep a fixed row-label rail for the twelve native drum rows and the bass projection. Show the two 32-step cycles as `BAR 1 · 1–32` and `BAR 2 · 33–64`, with a strong step-33 divider and lighter beat/subdivision grouping.
   - The current playhead, hit states, active row, passed rows, and unreached rows must remain visually distinguishable while the complete loop stays in view.
   - The score band must be the largest single visual region and the first place the eye lands. The pad must never equal or exceed its visual weight.

3. **Action deck — full chassis width**
   - Use three intentional zones instead of a tall right sidebar:
     - **Control rail (left):** instrument switch, active profile, conditional bass octave, click, play/stop, and secondary REC.
     - **Lesson/action panel (centre):** adaptive Start lesson → Next row → Restart action, cue choice, reset pattern, and compact import/export actions.
     - **Visualizer pad (right):** a compact circular translator that stays synchronized with the grid and remains available as a small pad-to-grid recording window in Compose.
   - The action deck must consume only the lower portion of the chassis. It must not create a large empty column beside the score or force core controls into a vertical stack.
   - Utility actions must be visually subordinate to the lesson progression action. There must be one obvious primary action in each lesson state.

### State and interaction requirements

- **Compose:** grid editing is enabled; the pad is available for optional REC capture; the selected drum/bass profile applies globally to that instrument’s existing loop.
- **Guided:** grid editing, instrument switching, and REC are disabled; Play/Stop pauses or resumes the guide. The active row is bright/full-volume, passed rows are slightly muted/quieter, and unreached rows are gray/silent. The pad follows the active pass instrument.
- **Paused:** the grid becomes editable and displays `Lesson paused — editing restarts lesson`; any accepted edit returns guidance to the beginning.
- **Complete:** expose Restart/Start over and allow a user to select any populated row to redo that row without changing the authored pattern.
- **Empty pattern:** the first screen is a blank score with the primary action clearly inviting authoring or starting guidance only when populated content exists.

### Responsive and visual rules

- 1280×720 is the acceptance floor; 1680×1046 is the wireframe comparison size. At both sizes, the score, row labels, playhead, active row, primary lesson action, and pad are visible without scrolling.
- The grid must gain width before controls gain width. Do not solve density by shrinking the score into a narrow pane or by moving the pad into a tall sidebar.
- Preserve the dark/orange visual language, but use contrast and scale to establish hierarchy: score first, lesson action second, pad/control utilities third.
- Keep control targets at least 44px high and keep labels readable at the floor viewport. Do not use opacity to hide controls that are still actionable.

### Acceptance criteria

1. At 1280×720, a clean Compose render shows the full 64-step score, twelve drum row labels, both bar labels, playhead, status band, action deck, and compact pad in one viewport.
2. At 1680×1046, the render matches the wireframe’s single-chassis composition: full-width header, dominant middle score, horizontal lower deck, and pad anchored at lower right; there is no persistent `Structure`/`Instrument` split with unused vertical space.
3. The score occupies the largest visual region and spans the chassis width; the pad occupies a clearly smaller translator area and never competes with the score for primary attention.
4. Compose, Guided, Paused, and Complete each preserve the same spatial hierarchy while changing only the state-appropriate controls and emphasis.
5. Guided-state contrast communicates active/passed/unreached rows without globally dimming the action controls or making `Next row` difficult to find.
6. Browser verification records screenshots at both target sizes, confirms no clipped/hidden core controls, and reports no console errors or warnings.

### Out of scope

This story changes workspace composition and visual hierarchy only. It does not add free-float bass, preset/library surfaces, song upload, hardware input/sync, scoring, new audio assets, or a new persistence model.

## Locked decisions

- **Design:** maintain the current dark, orange-accent direction. Grid state carries hierarchy; the circular pad is smaller and always visible as translator.
- **Desktop target:** MacBook-class viewport, floor 1280×720. At/above that floor, show all 64 columns with no horizontal movement required in guidance.
- **Header:** concise status (`BPM · instrument/profile · pass n/total`), tempo, quiet branding, and eight beat dots. The active pass belongs on its grid row, not in the header.

## Execution instructions (priority order)

### 1. 64-step grid-first desktop layout (Priority 10)
- **Goal:** the user’s eye goes to the full score first, then to the current row and pad translation.
- **API contract:** retain existing component boundaries where possible; reshape `App`/CSS layout around `Header`, dominant `StepGrid`, compact control rail/action strip, and compact `BeatPad` translator.
- **Data model:** none; layout only consumes current mode, banks, guide state, and transport state.
- **Key decisions:** group columns 1–32 and 33–64 as the two four-beat cycles; strong dividers at bars/beats, lighter subdivision lines. Reserve a fixed row-label rail. Protect cell geometry at 1280×720; do not compress labels into tracks or hide half the loop.
- **Acceptance:** at 1280×720 the entire 64-step two-bar loop, labels, playhead, and active row are visible together. The pad does not take equal or greater visual area than the grid.

### 2. Mode-aware compact controls and REC states (Priority 11)
- **Goal:** every control says what it affects without turning the lower workspace into a dashboard.
- **API contract:** the control rail groups DRUMS/BASS, that mode’s bank, conditional bass octave, click, play/stop, and REC. The action strip exposes adaptive Start/Next/Restart, reset, import/export, and cue choice.
- **Data model:** selected active instrument is UI state; it selects which persisted bank the profile control updates. `REC` is UI state and never serializes.
- **Key decisions:** when REC is armed in Compose, say/show the receiving instrument/row. In Guided, REC and grid editing are disabled; the existing Play/Stop control pauses/resumes the guide. In Paused, editing is enabled with a `Lesson paused — editing restarts lesson` notice. Keep import/export compact; no library/preset surface.
- **Acceptance:** switching mode updates the visible bank control and only that instrument’s bank. Octave is absent/disabled in drums. REC capture writes only in Compose. A user can identify why an unavailable control is disabled.

### 3. Accessibility and desktop UAT (Priority 12)
- **Goal:** support a focused, keyboard-usable live score rather than a colour-only visual toy.
- **API contract:** preserve pad keyboard mappings and transport keys; add accessible names/pressed state/tooltips to every icon control; announce transport/guide state through a concise live region.
- **Data model:** none.
- **Key decisions:** contrast AA; 44px targets for controls; active/passed/unreached use text/shape/opacity plus colour; reduced-motion setting calms playhead/pad cue; no focus trap in import confirmation/modal.
- **Acceptance:** keyboard can select controls and audition pad without triggering hidden actions in dialogs; reduced motion suppresses sweeping animation; test Compose, Guided, Paused/edit-reset, Import error, and export at 1280×720 with no console errors.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Single-chassis grid-first workstation | Done | 2026-07-15 | Reworked into one full-width header, dominant 64-step score band, and horizontal lower action deck with compact control rail, lesson actions, and lower-right visualizer pad; verified at 1280×720 and 1680×1046. |
| 2 | Mode-aware compact controls and REC states | Done | 2026-07-15 | Compact action strip exposes guidance/reset/import/export/cue actions; mode-owned banks, drum octave disablement, and Compose-only REC verified in the browser. |
| 3 | Accessibility and desktop UAT | Done | 2026-07-15 | Keyboard pad audition, modal isolation, 44px visible controls, reduced-motion coverage, guided locks, pure self-checks, and clean 1280×720 browser UAT pass. |
