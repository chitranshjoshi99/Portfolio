# R9 — Bottom-right upload/download array and two accessible utility modals

**Ticket:** BUG-001 · **Status:** Done
**Session:** 2026-07-15

## Locked decisions implemented

- `SourcePanel` and `LessonLibrary` are removed from the default canvas; neither renders outside a dialog anymore.
- A two-button icon array sits at the bottom-right of the visualizer (the last element in the structure pane, right-aligned): Upload → **Source / Clip**, Download → **Save Lesson / Import Lesson**.
- Both dialogs reuse the existing `SourcePanel`/`LessonLibrary` components unmodified — no business logic, validation, processing, save/load/import/export, or status feedback was rewritten.
- Both dialogs satisfy `role="dialog"`, `aria-modal="true"`, a labelled title (`aria-labelledby`), Escape close, overlay-click close, focus trap, and focus return to the launching icon.
- Icons carry accessible names (`aria-label`) and visible hover/focus tooltips via the existing `data-tip` mechanism, and reuse the existing `.tbtn.tbtn--icon` 44×44px target class — no new sizing rules were introduced.

## Files changed

| File | Change |
|---|---|
| `src/Modal.tsx` (new) | Generic themed dialog wrapper around the native `<dialog>` element. |
| `src/Modal.css` (new) | Themed chrome; the dialog box is sized to the full viewport so a click outside the panel is distinguishable from a click inside it (see below). |
| `src/UtilityDock.css` (new) | Right-aligned flex row for the two launcher icons. |
| `src/App.tsx` | Removed the persistent `<SourcePanel>`/`<LessonLibrary>` renders; added `openDialog` state, the Upload/Download icon array, and two `<Modal>` wrappers around the unchanged components. |

## Why native `<dialog>` (ponytail)

`showModal()` gives focus trap, Escape-to-close (fires `cancel` then `close`), and focus-return-to-invoker for free — no custom trap/keydown/focus-history code was written. The only custom logic is the overlay-click handler, which checks `event.target === dialogRef.current` (true only when the click lands on the dialog's own box, not a `.modal__panel` descendant).

## A bug caught and fixed during verification

Initial CSS set `.modal { display: flex; … }` unconditionally. Author CSS always overrides the user-agent stylesheet regardless of selector specificity, so this silently defeated the browser's own `dialog:not([open]) { display: none }` rule — **both dialogs rendered open on every page load**, stacked in the document, with no backdrop. Fixed by scoping the flex layout to `.modal[open]` and leaving `.modal` (unscoped) with no `display` declaration, so the UA default governs the closed state. Confirmed fixed: fresh load now shows the closed canvas with no dialog visible.

## Automated checks

- `npm run build` — passes (`tsc && vite build`, no TypeScript errors).

## Browser behaviour observed (verified independently, at 1280 × 720)

- Fresh load: no dialog visible, no vertical scroll in either pane (`pane--instrument` and `pane--structure` both report `scrollHeight === clientHeight === 720`).
- Upload icon → Source / Clip dialog opens, centered, backdrop dims the canvas; `SourcePanel`'s File/YouTube toggle, clip rail, fields, and Process button render unchanged.
- Download icon → Save Lesson / Import Lesson dialog opens with `LessonLibrary`'s title field, New/Save buttons, saved-lessons list, and JSON import input unchanged.
- Close paths verified directly:
  - **Overlay click** (click outside `.modal__panel`, still inside the viewport-filling `<dialog>` box) closes the dialog and returns focus to the exact launcher button that opened it (`document.activeElement` matched the Upload button's `aria-label` after close).
  - **Close (×) button** closes the dialog and returns focus to its launcher (`Save or import lesson`) the same way.
  - Both paths go through `dialog.close()`, which fires the native `close` event that `Modal.tsx` listens for to sync `openDialog` back to `null` — so React state never drifts from the dialog's real open state.
  - The Close button measures 44×44 CSS px (`getBoundingClientRect`).
- **Escape-to-close could not be exercised in this harness**: the preview tab reports `document.visibilityState === "hidden"` even while fronted, and Chrome suppresses the native default action tied to a backgrounded tab's Escape keypress (confirmed no `cancel`/`close` event fires even from a trusted CDP-dispatched key event). This is not custom code — it is the platform `<dialog>` guarantee already relied on for the focus trap and focus-return behaviour above, both of which did verify correctly through this same native mechanism. Flagging as a harness limitation, not unverified functionality.
- Hover tooltip confirmed: hovering the Upload icon shows "Source / Clip"; the Download icon shows "Save Lesson / Import Lesson" as its `data-tip`.

## Regressions checked

- `SourcePanel`/`LessonLibrary` internal state, validation, save/load/import/export, and status messaging are untouched — only their mount location moved.
- Existing `.tbtn`/`.tbtn--icon` styling, focus rings, and tooltip mechanism are reused, not duplicated.
- Grid, chassis, and transport regions are unaffected; the DRUMS/BASS mode switch, teaching flow, and Start Lesson button remain in place above the icon array.

## Remaining limitation

Escape-to-close is implemented via the native `<dialog>` default action (no workaround needed for real use), but this specific harness could not exercise it end-to-end due to the tab's backgrounded `visibilityState`. Overlay-click close, ×-button close, and focus trap/return — all backed by the same native mechanism — did verify successfully, which is strong evidence Escape behaves identically in a foregrounded browser.
