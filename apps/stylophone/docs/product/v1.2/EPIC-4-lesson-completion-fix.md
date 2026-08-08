# EPIC 4: Lesson-completion UX fix

Fix a confirmed UAT bug carried over from v1.1: after finishing a guided lesson, the grid
is already editable but nothing tells the user so — they only ever see "Restart" and never
discover an edit exits back to compose. Accepted as a scoped exception to v1.2's "no
musical-functionality changes" rule.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a user who just finished or wants to exit a guided lesson, I want an explicit control to return to editing so that I don't have to discover by accident that clicking the grid already works. | Medium | Low | 7 |

> Severity & complexity are **business/conceptual** metrics. Development effort is
> deliberately ignored (see grilling-doctrine §6). Priority is a strict order.

## Locked decisions

- **Tech stack:** React 18 + TypeScript + Vite (unchanged).
- **Project structure:** no new files. Edit `src/components/LessonPanel.tsx` (already owns
  `guideStatus`/`guideLabel`/`onRestartGuidance`) and wire a new prop through from
  `src/hooks/usePattern.ts`.
- **Architecture:** **this is not a state-machine change.** `commitPatternEdit` in
  `usePattern.ts` already accepts edits and calls `setGuideCompose()` at `"paused"` and
  `"complete"` status — the grid was never actually locked outside `"guided"` status. The
  fix adds a new `onStopLesson` prop wired directly to the existing `setGuideCompose()` —
  same function `onRestartGuidance` already calls, just reachable without touching the
  grid first. No new state, no reducer change (Architect, v1.2 — verified by reading
  `usePattern.ts` directly, not assumed).
- **Deployment:** N/A this epic.
- **Security:** N/A — no new trust boundary.
- **Design:** N/A beyond the button itself — no new visual language, matches existing
  action-strip button styling.
- **Legal/compliance:** N/A.
- **Data/market basis:** N/A.

## Execution instructions (priority order)

### 1. Add Stop/Continue-editing control  (Priority 7)
- **Goal:** at `guideStatus === "paused"` or `"complete"`, an explicit button is visible
  that returns to compose/editing in one click — no grid-click discovery required.
- **Key decisions:** wire the button to the existing `setGuideCompose()` exported from
  `usePattern.ts`, passed to `LessonPanel.tsx` as a new `onStopLesson` prop, rendered next
  to the existing `onRestartGuidance` control. Do not add a new `GuideStatus` value, do not
  touch `derivePasses`/`passState` in `src/lib/guidance.ts`.
- **Acceptance:** from `"complete"` or `"paused"` status, clicking the new control lands
  in `"compose"` status with the grid editable — same observable result as the existing
  "click the grid to restart" path, just reachable without that discovery step. Guided
  (`"guided"` status) editing remains blocked, unchanged.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Add Stop/Continue-editing control | Done | 2026-07-16 | New `onStopLesson` prop wired straight to existing `setGuideCompose()`; "Continue editing" button added in `LayerStack.tsx` at `paused`/`complete` status. No new state. Verified live: complete → click → lands in compose with grid editable. |

> Status ∈ {Not started, In progress, Blocked, Done}. Update this and the matching net
> tracker in every build session.
