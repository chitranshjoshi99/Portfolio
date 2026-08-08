# EPIC 3: Touch hardening

The app was built mouse-first and touch was never a first-class input. The clearest symptom:
the browser registers a cursor on tap but never clears it on touch-end, so elements stay
stuck in `:hover` state after a tap. This epic fixes it at the root — systemically, not
element-by-element. Small, independent, and cheap; can be slotted at any point in the cycle.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a touch user, I don't want elements stuck in hover state after I tap them, so the UI stops looking broken on a tablet. | Medium | Low | 1 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

Non-negotiable choices a future build session must not re-litigate:

- **Tech stack:** CSS only. **No JS, no dependencies.**
- **Project structure (locked placement):** edits live in the existing component `.css`
  files under `src/components/` (and `src/App.css` / `src/theme.css` if any hover rules live
  there). No new files.
- **Design (DG) — systemic root-cause fix:** gate **every** `:hover` style behind
  `@media (hover: hover)` so hover effects only exist on devices with a real hovering pointer.
  On touch, hover rules never apply → nothing can get stuck. One systemic move, **not**
  per-element whack-a-mole.

## Execution instructions (priority order)

### 1. Gate all hover styles behind `@media (hover: hover)`  (Priority 1)
- **Goal:** no element retains a hover appearance after a tap on touch devices, with zero
  behaviour change on mouse.
- **Key decisions:**
  - There are **6 `:hover` rules** across `src/**/*.css` today and **0** are guarded. Wrap
    each in `@media (hover: hover) { … }` (or `@media (hover: hover) and (pointer: fine)`).
    Locate them with `grep -rIn ":hover" src --include='*.css'`.
  - Do not convert hover interactions into JS pointer handling — the CSS media feature is the
    intended platform mechanism for exactly this.
  - Keep `:active`/`:focus-visible` states intact (those are the correct touch/keyboard
    feedback); only hover is gated.
- **Acceptance:** on a tablet (or dev-tools touch emulation), tap any button/cell that had a
  hover style → it does **not** stay visually hovered after the tap; on desktop with a mouse,
  hover styling is unchanged. `grep -rIn ":hover" src --include='*.css'` shows every rule now
  inside a `hover: hover` block.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Gate hover styles behind `@media (hover: hover)` | Done | s6 | All 7 current hover selectors gated; focus-visible/active preserved. Build + live desktop browser check pass; tablet layout rendered at 768px (browser cannot emulate coarse pointer). |

> Status ∈ {Not started, In progress, Blocked, Done}. Each build session updates this
> table before finishing so the next session knows where it left off.
