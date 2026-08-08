# R8 — Fixed 12×32 mode-projected grid

**Ticket:** BUG-001 · **Status:** Done
**Session:** 2026-07-15

## Locked decisions implemented

- The grid always renders 12 rows × 32 steps. The existing instrument `mode` is the only projection state; no second grid toggle was introduced.
- DRUMS projection labels each row with hardware position and voice, read from `DRUM_BY_PAD[pad].label` — `1 · Kick drum` through `7 · Ride cymbal`. No second label list exists.
- BASS projection maps the same 12 row positions to chromatic pitch classes in consistent sharp notation, `1 · C` through `7 · B`, and every filled bass cell displays its stored octave.
- Row labels live in a fixed rail outside the step plane and consume none of the 32 step tracks.
- Switching mode changes visibility and edit routing only. Both stored layers remain intact and audible.

## Files changed

| File | Change |
|---|---|
| `src/StepGrid.tsx` | 12-row projection by mode; `NOTE_BY_PAD` sharp labels; label rail split from the step plane; octave rendered on filled bass cells. |
| `src/StepGrid.css` | One shared 32-column template driven by custom properties; the `aspect-ratio` / `min-height` conflict removed in favour of explicit row height and cell width; plane scrolls horizontally while the rail stays fixed. |
| `src/App.tsx` | Passes `mode` to the grid; `handleSelectBass` now places the clicked row's pitch class on an empty cell; `dimmedLanes: Set<Lane>` collapsed to a single `dimmed: boolean` and the now-unused `Lane` type removed. |

## Shared column template

`.step-grid` defines `--sg-cell`, `--sg-gap`, `--sg-beat`, `--sg-row` and one track list, `--sg-cols: repeat(8, calc(var(--sg-cell) + var(--sg-beat)) var(--sg-cell) var(--sg-cell) var(--sg-cell))` — eight beats of four tracks each. The header and all 12 data rows consume that same variable, so beat grouping lives in the template rather than shrinking a cell, and every one of the 32 buttons is exactly 14px. The bar divider at step 16 is a border drawn inside the cell box, so it costs no column geometry. The playhead is per-cell and therefore inherits the same columns.

## Automated checks

- `npm run build` — passes (`tsc && vite build`, no TypeScript errors).

## Browser behaviour observed (verified independently of the implementing agent)

At 1280 × 720:

- 12 rows, 32 header cells, 32 cells per row.
- **Column alignment: maximum |header.left − row.left| across all 32 columns = 0.000px.** Adjacent-cell overlaps: 0. This is the proof that the header, the rows, the divider, and the playhead share one template.
- Grid height 326px, inside the ~420px budget.
- DRUMS shows `1 · Kick drum` … `7 · Ride cymbal`; BASS shows `1 · C` … `7 · B` with the ♯ character.

Layer preservation (the load-bearing check):

1. In DRUMS, filled `1 · Kick drum step 6`.
2. Switched to BASS. Clicked row `4.5 · F♯` at step 10 — the note landed on the **clicked row's** pitch class, not the last-played pad, and rendered its octave.
3. Switched back to DRUMS: `1 · Kick drum step 6` still `aria-pressed="true"`.
4. Switched back to BASS: `4.5 · F♯ step 10` still filled, still showing its octave.

Neither hidden layer was deleted, rewritten, or muted by the projection switch.

At 900px wide:

- Step plane scrolls (`scrollWidth` 542 > `clientWidth` 416) while the rail label stays fixed at `left` 424.5px before and after scrolling.
- Cells hold their 14px geometry; 0 overlaps; column alignment delta still 0px.

## Regressions checked

- Beat grouping and the step-16 bar divider are intact.
- Every cell remains a button with `aria-pressed` and an `aria-label` naming its row and step; focus rings, the dashed selection ring, and the playhead outline are unchanged.
- Theme unchanged: orange accent only; no use of the semantic green `--hit`.
- Teaching dim preserved via the simplified `dimmed` flag.

## Remaining limitation

The structure pane still scrolls vertically at 1280 × 720 because `SourcePanel` and `LessonLibrary` remain on the canvas above the grid. Removing them is R9's scope, not R8's; the no-scroll acceptance criterion for the pane is verified there.
