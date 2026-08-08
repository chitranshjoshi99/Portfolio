# BUG-001 — Main workspace layout and visual hierarchy

**Status:** Validated by Design Girl · revised device, pad, grid, and theme specification locked
**Severity:** High (core practice surface is persistently obstructed)
**UX severity:** 3 / 4 — Major
**Complexity:** High (layout + modal flow + possible lesson-schema change)
**UAT priority:** 2
**References:** [Physical Stylophone Beat](assets/beat-reference.png) · [Pad geometry close-up](assets/pad-geometry-reference.png)

## User impact

The first screen does not behave like a compact instrument. The replica is a vertical stack of unrelated controls, both panes scroll before the main workflow is visible, and the dense grid cannot preserve stable step geometry. A player must scroll and translate between the app and the physical device during every practice session.

## Reproduction evidence

Validated in the running app at a **1280 × 720** viewport:

- Left instrument pane: `720px` visible height versus `936px` content height.
- Transport begins at `y=670` and ends at `y=806`, below the viewport.
- Right structure pane: `720px` visible height versus `995px` content height.
- Persistent source panel consumes `476px` before the grid begins at `y=602`.
- Lesson library begins at `y=738`, entirely below the initial viewport.
- Each step cell is forced to `24 × 24px`; 32 columns plus grouping margins exceed the available grid width. The conflict comes from `aspect-ratio: 1`, `min-height: 24px`, and a 32-column fractional grid.

Relevant implementation:

- `src/theme.css:48` — equal-height two-pane shell with independently scrolling panes.
- `src/App.tsx:398` — instrument components are rendered as a vertical sequence.
- `src/App.tsx:453` — upload, lesson flow, grid, editor, and library all share one persistent column.
- `src/BeatPad.tsx:6` — all 12 wedges currently share identical inner/outer radii.
- `src/TransportControls.tsx:38` — text-heavy transport and mode groups expand across two rows.
- `src/StepGrid.tsx:6` — grid is hard-coded to four lanes.
- `src/StepGrid.css:31` — the 32-column layout conflicts with the cell minimum geometry.
- `src/SourcePanel.tsx:80` and `src/LessonLibrary.tsx:123` — utility workflows remain permanently visible.

## Design Girl verdict

| UAT request | Verdict | Reason |
|---|---|---|
| Compact replica matching the physical device | **Accept with a strict fidelity boundary** | Pad geometry must be physically exact. The surrounding chassis remains a compact reinterpretation and does not reproduce decorative dead space. |
| Revised control topology | **Accept** | BPM sits top-right with tempo directly below; transport sits bottom-left; DRUMS/BASS sits bottom-middle; the pad dominates mid-right with a vertical octave control immediately to its left. |
| Profile control at mid-left | **Accept as a 2×2 selector** | Four explicit cells are easier to scan and operate than a small four-position vertical switch. ROK is active in v1; unavailable banks remain visibly and natively disabled. |
| Symbol-only Click / Play / Record | **Accept** | Metronome, play/stop, and record symbols reduce the transport footprint. Accessible names and visible tooltips remain mandatory. |
| Exact physical pad-key geometry | **Accept** | Natural keys meet edge-to-edge and form an uninterrupted inner traversal lane. Each `.5` key is centered between two natural keys and has roughly half their radial length. |
| Hide upload and lesson persistence behind icons/modals | **Accept** | These are setup/utility tasks, not the main practice action. Keeping them persistent buries the grid. |
| Fixed 12-row grid projected by mode | **Accept; replaces the 13-row model** | DRUMS shows 12 physical pad/sample rows; BASS shows 12 chromatic pitch rows. Reusing the same 12×32 surface is denser and makes the instrument mode the single source of truth. |
| Repair collapsing and misaligned steps | **Accept** | Labels must occupy a separate fixed rail and never participate in the 32-column width calculation. Headers, playhead, and cells must share one step template. |
| Keep the current orange theme | **Accept; supersedes the earlier white-accent revision** | The existing orange system accent already gives the product a coherent identity. Soft-white remains text/neutral contrast; semantic green remains confirmed-hit feedback. |

## Locked design resolution

### 1. Compact device panel

- Render one bounded device chassis with an aspect ratio of approximately **3:2**.
- Use this explicit spatial contract:
  - **Top-right:** BPM display, with the tempo knob directly underneath it.
  - **Mid-left:** compact **2×2 profile selector** ordered `ROK / HIP` over `TEC / BOX`. ROK is selected; HIP, TEC, and BOX use native disabled states until their audio profiles ship.
  - **Immediately left of the pad:** a vertical octave control with up, current octave, and down arranged on one axis.
  - **Mid-right:** the circular pad as the dominant control and largest element in the chassis.
  - **Bottom-left:** three-button metronome / play-stop / record array using symbols only.
  - **Bottom-middle:** compact DRUMS/BASS mode switch.
- These regions may tighten responsively, but their order and adjacency must not change or overlap.
- The instrument is one composition, not a column of cards. Remove the two diagnostic text rows from the visible chassis; expose their information through control state/tooltips where needed.
- At **1280 × 720**, both primary panes must fit without vertical scrolling when utility modals are closed.
- Weight the desktop split toward the visualizer (approximately `42% / 58%`) and reduce pane padding so 32 stable columns fit.

### 2. Circular pad geometry

- Keep native clockwise labels: `1, 1.5, 2, 2.5, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7`.
- Natural keys extend from the outer ring to the center-circle boundary and meet neighboring natural keys edge-to-edge. The inner half of the pad must contain no dead gaps between natural keys.
- Each `.5` key is centered over the boundary between its neighboring natural keys, occupies only the outer half of the radial depth, and never touches the center circle. It must read and behave like a black piano key laid over two white keys.
- Layer hit regions deliberately: the `.5` target owns its visible outer key area, while the uninterrupted inner lane remains owned by the neighboring natural keys. Do not enlarge a `.5` hit region inward toward the center.
- Preserve at least a 44px effective target for `.5` keys by using sufficient pad diameter and tangential/outer-edge hit area, without stealing the inner natural-key traversal lane.
- In BASS mode, dragging through the inner lane from `1` to `2` must switch directly and continuously with no silence and no accidental `1.5`; crossing the outer `.5` key must select `1.5`.
- Retain the current orange pad and interaction styling; do not introduce the previously proposed pad-only/global-white token split.

### 3. Compact transport

- Replace visible text with consistent inline SVG symbols:
  - Click: metronome glyph.
  - Play: triangle; while playing, square stop glyph.
  - Record: circle.
- Keep `aria-label`, `aria-pressed`, focus styles, and a hover/focus tooltip for every icon-only control.
- The visual button array remains compact, but each individual target remains at least 44 × 44px.

### 4. Utility modals

- Remove `SourcePanel` and `LessonLibrary` from the default canvas.
- Add a two-button utility array at the **bottom-right of the visualizer**:
  - Upload symbol → **Source / Clip** modal, containing the existing source selection, clip controls, validation, processing, and draft-generation flow.
  - Download symbol → **Save Lesson / Import Lesson** modal, containing save, load/library, JSON import, and export/download actions.
- Icons must have accessible names and tooltips so their direction is not ambiguous.
- Both dialogs require `role="dialog"`, `aria-modal="true"`, a labelled title, Escape/overlay close, focus trap, and focus return to the launcher.
- Processing, validation, save/load/import/export, and status feedback remain functionally unchanged inside the dialogs.

### 5. Grid geometry

- Preserve **32 steps** and visible four-step beat grouping.
- Keep exactly **12 rows**. The existing main instrument mode selects the grid projection; do not add a second grid tab state.
- **DRUMS projection:** one row per physical pad/sample, labelled with the locked hardware position and voice from BUG-002 (`1 · Kick`, `1.5 · Clap`, `2 · Snare`, through `7 · Ride`).
- **BASS projection:** one row per pitch class, labelled with hardware position and note (`1 · C`, `1.5 · C♯`, `2 · D`, `2.5 · D♯`, `3 · E`, `4 · F`, `4.5 · F♯`, `5 · G`, `5.5 · G♯`, `6 · A`, `6.5 · A♯`, `7 · B`).
- Bass cells display their stored octave (`−2`…`+2`) so repeated pitch classes remain distinguishable.
- Switching projection changes only what is visible/editable. Both stored layers remain intact and continue playing during loop playback.
- Remove the `aspect-ratio`/`min-height` constraint conflict. Use explicit stable row height and column width.
- Build the visualizer as two coordinated regions: a fixed-width row-label rail and one scrollable 32-step plane. Row labels must not be children of, or consume tracks from, the 32-column step grid.
- The numbered header, every data row, bar dividers, and playhead must use the same 32-column template and identical gap/padding values. Column centerlines must match from header to final row.
- The desktop visualizer must fit all 32 columns without overlap. Below the supported width, preserve cell geometry and scroll the grid horizontally rather than compressing cells into one another.
- Row labels remain fixed while the step area scrolls.
- Playhead, selection, filled cells, and bar divider must remain aligned across all rows.

### 6. Theme

- Retain the current matte-charcoal interface and existing orange system accent. The earlier proposal to make soft-white the global accent and confine orange to the pad is withdrawn.
- Orange may continue to identify active controls, pad interaction, selected cells, playhead emphasis, tempo state, and primary modal actions.
- Soft-white remains the primary text and high-contrast neutral; semantic green remains reserved for confirmed/correct hit feedback.
- State must continue to use shape, text, outline, or motion in addition to color. Keeping orange does not permit color-only state communication.

## Resolved grid contract — fixed 12×32 surface

The previous 13-row proposal is retired. The grid always renders **12 rows × 32 steps**, and the existing instrument mode chooses the projection:

- In **DRUMS**, rows `1` through `7`, including `.5` positions, are 12 independent physical-pad event lanes.
- In **BASS**, those same row positions represent the 12 chromatic pitch classes; note cells retain octave and length.
- The main DRUMS/BASS control drives both instrument input and grid projection.
- Drum and bass remain separate stored layers. Changing mode never deletes, rewrites, or mutes the hidden layer.
- During a guided lesson, the current teaching layer may set the mode/projection automatically; leaving the lesson restores normal manual switching.
- Drum hits persist exact `pad` identity; coarse reduction classes map to canonical pads rather than replacing physical identity. Schema/audio migration remains owned by `BUG-002`.

## Acceptance criteria

- Initial desktop view at 1280 × 720 has no vertical scroll in either pane with dialogs closed.
- Device chassis follows the reference topology and approximately 3:2 proportions.
- BPM is top-right with tempo immediately underneath; transport is bottom-left; mode is bottom-middle; profile is mid-left; vertical octave is immediately left of the dominant mid-right pad.
- Profile is a 2×2 `ROK / HIP / TEC / BOX` selector; unavailable v1 profiles are visibly and natively disabled rather than pretending to work.
- Natural pad keys meet without dead space along the inner lane. `.5` keys sit between them at approximately half radial length and keep accessible hit targets without intruding into that lane.
- A held BASS pointer can slide directly from `1` to `2` through the inner lane without silence or accidental `1.5`; moving through the outer half can intentionally select `1.5`.
- Transport is symbol-only visually and fully named for assistive technology.
- A bottom-right upload icon opens Source / Clip; the adjacent download icon opens Save Lesson / Import Lesson. Both are accessible dialogs.
- Grid always has 12 labelled rows and switches correctly between the DRUMS pad/sample projection and BASS chromatic projection.
- Bass rows use consistent sharp notation and every filled bass cell exposes its octave.
- Mode switching preserves both layers and does not interrupt loop playback; switching away from BASS releases only a currently held live note.
- All 32 steps remain distinct with no overlap at the desktop target; narrower layouts scroll rather than collapse.
- The label rail never offsets or compresses the step plane; numbered headers, cells, dividers, and playhead remain aligned across all 32 columns.
- The current orange theme is preserved globally; soft-white remains neutral/text contrast and semantic green remains limited to hit confirmation.
- Existing audio scheduling, playback, editing, persistence, reduction, teaching, and keyboard behavior regressions are not introduced.

## Audit principle coverage

- **Status:** existing pressed states, processing state, playhead, and live regions are strengths to preserve.
- **Real-world match:** current component order and equal pad wedges fail the physical-device map; the new chassis and sharp geometry correct it.
- **Control/freedom:** utility dialogs must be dismissible and return focus.
- **Consistency:** one icon family and the existing orange-accent system are required.
- **Error prevention/recovery:** existing validation and dirty-confirm behavior remain inside the dialogs.
- **Recognition:** icon-only controls require tooltips and accessible names.
- **Efficiency/minimalism/structure:** persistent setup forms and vertical instrument stacking are the principal failures.
- **Affordance/accessibility/perceptibility:** retain 44px targets, focus rings, non-color state cues, and reduced-motion behavior.
- **Tolerance:** the grid must scroll at constrained widths instead of destroying cell geometry.
