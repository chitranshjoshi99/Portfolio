# EPIC 4: Stable, polished controls

Keep learning controls calm, stable and spatially intentional without changing the established horizontal layout.

## User stories
| # | User story | Severity | Complexity | Priority |
|---|---|---|---|---:|
| 1 | Lesson actions never shift layout. | High | Low | 6 |
| 2 | Motion/spacing feel consistent. | Medium | Medium | 7 |

## Execution instructions

1. Rebuild LessonPanel/LayerStack around permanent zones: lesson-step display; Save/Load and dim Reset icon stack; remaining action array; one fixed-size primary-action slot. Render every relevant action on every state and change eligibility only with `disabled`, `aria-describedby`, and visual dimming. Labels may change Start/Next/Continue editing but the primary footprint may not.
2. Move Duplicate bar 1 → 2 from LessonPanel into a labelled icon control at the score grid lower-right. Preserve its existing guided-state gating.
3. Introduce CSS custom-property spacing tokens in `theme.css` and replace repeated local gaps/padding with the token scale. Do not mechanically rewrite unrelated geometry.
4. Use CSS transitions for visualizer expansion and sibling-panel layout, and modal enter/exit. Spring-snap applies only where position/size changes. Transport playhead, painted cells, mode changes and disabled states remain short crisp transitions.
5. In `prefers-reduced-motion`, remove spatial spring travel and use opacity/snap while retaining every interaction.

## Acceptance

- Across compose/guided/paused/complete, LessonPanel outer dimensions and action zones do not shift.
- Duplicate is discoverable at the grid and remains keyboard-accessible.
- Expansion/reflow and modals animate; reduced-motion does not. At all supported horizontal widths, no overlap, clipping or focus loss occurs.

## Tracker
| # | Status | Notes |
|---|---|---|
| 1 | Done | Permanent LessonPanel zones and score-grid Duplicate control verified across guide states and supported widths. |
| 2 | Done | `theme.css` owns `--space-1..7` and `--dur-*`/`--ease-*`; 97 spacing declarations tokenised pixel-identically; modal enters/exits via native `@starting-style` + `allow-discrete`; reduced-motion coverage completed (Walkthrough highlight was the last gap). Verified by build, a token-expansion diff script, and browser `getAnimations` on expand/modal open/close. Reduced motion itself is rule-verified only — the browser tool cannot force the media query, so one manual OS-setting pass is still owed at the v1.4 gate. |
