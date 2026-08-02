# R7 — Compact device and pad

**Ticket:** BUG-001 · **Status:** Done
**Session:** 2026-07-14

## Locked decisions implemented

- Physical pad-key geometry: 7 natural keys as full-depth wedges meeting edge-to-edge, 5 half-step keys straddling the natural boundaries at half radial depth.
- Device chassis carrying the locked control topology, revised in UAT on 2026-07-14 (see "UAT revision" below).
- Symbol-only metronome / play-stop / record controls.
- Retained the existing orange accent on matte charcoal; green remains reserved for hit confirmation.

## UAT revision (2026-07-14, user direction — supersedes the original chassis clauses)

The user revised the device layout during implementation review. The revised contract is now authoritative for R7:

- **No chassis frame.** The device is the pane, not a bordered card inside it, and it takes the full vertical space. The ≈3:2 aspect clause is retired with the frame — there is no longer a bounded box to proportion.
- **Top-left:** BPM readout with the tempo knob directly underneath it (previously top-right).
- **Top-right:** the `Stylophone Beat · ROK` nameplate with the 8-dot beat indicator beneath it, both anchored to the top edge rather than vertically centred.
- **DRUMS / BASS** is a horizontal pair (previously stacked).
- **Octave axis and profile grid share one height** (124px), so they read as a matched pair across the mid row.

Unchanged from the original contract: 2×2 profile selector mid-left with ROK enabled and HIP/TEC/BOX natively disabled, vertical octave immediately left of the pad, dominant pad mid-right, symbol transport bottom-left, DRUMS/BASS bottom-middle.

## Files changed

| File | Change |
|---|---|
| `src/BeatPad.tsx` | Natural/half-step key model; layered `padAtPoint` hit testing; rewritten pure `_selfcheck`. |
| `src/BeatPad.css` | Half-step key fill/stroke; responsive pad sizing (min 300px). |
| `src/Device.css` | New. Chassis grid, region placement, tempo stack override, `.sr-only`. |
| `src/TransportControls.tsx` | Inline-SVG symbol transport, 2×2 profile selector (ROK/HIP/TEC/BOX), vertical octave. |
| `src/TransportControls.css` | Icon-key styling, tooltips, disabled treatment, 44px targets. |
| `src/App.tsx` | Instrument pane composed as one chassis; diagnostic text rows removed. |
| `src/theme.css` | 42% / 58% desktop split favouring the visualizer; reduced pane padding. |

## Geometry contract

| Constant | Value |
|---|---|
| Inner radius (centre circle) | 56 |
| Half-step band start (mid radius) | 103 |
| Outer radius | 150 |
| Natural sector width | 360 / 7 ≈ 51.43° |
| Half-step angular width | 34° (±17° about the natural boundary) |
| Half-step positions | boundaries 1\|2, 2\|3, 4\|5, 5\|6, 6\|7 (no 3.5, no 7.5) |

`padAtPoint` is layered: outside the annulus returns null; in the outer half the five half-step spans are tested first; everything else falls through to the natural whose sector owns the angle. The inner lane is therefore natural-only all the way around, so a BASS drag from `1` to `2` through the inner lane changes directly with no gap and no accidental `1.5`, while the outer path over the `1|2` boundary deliberately selects `1.5`.

## Automated checks

- `npm run build` — passes (`tsc && vite build`, no TypeScript errors).
- `BeatPad._selfcheck()` — pure coordinate assertions, all pass, including a 720-sample sweep at inner-lane radius 79.5 asserting no half-step is ever returned in the inner lane, plus assertions that the 3\|4 and 7\|1 boundaries carry no half-step and that the centre hole and outside-radius points return null.

## Browser behaviour observed (1280 × 720, DRUMS mode, dialogs closed)

- Instrument pane `scrollHeight` 720 = `clientHeight` 720 and `scrollWidth` 588 = `clientWidth` 588 — no vertical or horizontal scroll. Previous content height was 936px.
- Chassis fills the pane height; pad 308 × 308 and visibly the dominant element.
- Profile grid and octave axis both measure 124px tall — the matched pair the UAT revision asked for.
- Mode switch is a horizontal pair of 50 × 44 keys; transport keys 44 × 44.
- Transport keys measured 44 × 44 each (metronome, play/stop, record), each with `aria-label`, `aria-pressed`, a CSS tooltip, and a visible focus ring. Play swaps triangle → square glyph, so state is not carried by colour alone.
- Profile: ROK enabled and selected; HIP, TEC, BOX natively `disabled` with a dashed unavailable treatment.
- Octave: both buttons natively `disabled` and the group `aria-disabled="true"` in DRUMS; enabled in BASS with the previous octave preserved (R6 behaviour intact).
- Pad renders 7 full-depth naturals and 5 outer half-depth half-steps, matching `docs/bugs/v1/assets/pad-geometry-reference.png`.

## Regressions checked

- R3 pointer contract preserved: pointer capture, coordinate-based slide detection, release on pointerup / pointercancel / lostpointercapture, release on mode change away from BASS, release on unmount.
- R6 octave semantics preserved (native disabled + `aria-disabled` group + preserved octave value).
- All 12 keys remain individually focusable and activatable by Enter/Space in DRUMS mode.
- `prefers-reduced-motion` rules retained.

## Constraint worth carrying forward

The pad has a hard 300px floor: below that width a half-step key's radial depth drops under the 44px target minimum. The desktop pane split is sized around that floor (46% / 54%, giving the pad 308px) rather than the other way round. Any future change that narrows the instrument pane must re-check the half-step target size, and any change that widens it must re-check that the visualizer still fits 32 distinct columns.
