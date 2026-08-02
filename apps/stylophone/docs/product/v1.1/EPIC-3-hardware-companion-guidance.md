# EPIC 3: Hardware companion guidance

Turn the authored pattern into an honest instruction surface for recording it on the physical Beat. The app guides the sequence; the user alone confirms hardware completion.

## User stories

| # | User story | Severity | Complexity | Priority |
|---|-----------|----------|------------|----------|
| 1 | As a Beat owner, I want a guide to select each populated drum row then bass so that it matches how I build a loop on hardware. | Critical | Medium | 7 |
| 2 | As a Beat owner, I want to explicitly advance, restart, or redo a row so that I stay in control when I make a hardware mistake. | Critical | Medium | 8 |
| 3 | As a Beat owner, I want active, passed, and unreached material to sound/look different so that I can focus on the current pass. | High | Medium | 9 |

## Locked decisions

- **Architecture:** `derivePasses(pattern)` is pure. A pass is `{kind:"drum",pad}` for each populated pad in `PAD_IDS` order, followed by `{kind:"bass"}` only when the pattern has bass starts.
- **No verification:** there is no hardware input, scoring, timing grade, automatic advance, or claim that a physical recording succeeded.
- **Design:** active row gets the accent in the grid itself; completed content is quieter/dimmer; unreached content is silent/grey. The full grid remains visible.

## Execution instructions (priority order)

### 1. Derived row-by-row guide (Priority 7)
- **Goal:** every valid pattern becomes a deterministic hardware recording order without author-maintained lesson metadata.
- **API contract:** create pure exports `derivePasses(pattern): Pass[]`, `currentPass(passes,index)`, and `passState(passes,index,pass)`. `index = -1` is not started; `0..n-1` active; `n` complete.
- **Data model:** no persisted guide/order field. Drum row is populated when `drums[pad].some(Boolean)`; bass is populated when any start cell is non-null.
- **Key decisions:** empty rows never become passes. Drums-only and bass-only patterns are valid. Pass order is native visible pad order, not user-sortable.
- **Acceptance:** a pattern with pads 1, 4.5, 7 and bass derives exactly `[1,4.5,7,bass]`; a bass-only pattern derives `[bass]`; an empty pattern cannot start guidance.

### 2. Next, restart, redo, and restart-on-edit (Priority 8)
- **Goal:** guide behavior is explicit and cannot imply hardware verification.
- **API contract:** lesson action state maps to `Start lesson`, `Next row`, or `Restart`; provide `redoPass(pass)` to make a selected populated row current. A guide can be paused.
- **Data model:** guide state is ephemeral React state `{status:"compose"|"guided"|"paused"|"complete", passIndex}`. It is never serialized.
- **Key decisions:** `Next row` is user pressed. In Guided, the existing Play/Stop control is Pause/Resume; pause unlocks editing. Any accepted pattern edit resets to `{status:"compose", passIndex:-1}` and requires start from the beginning. Each active pass sets the presented instrument projection to its own kind (drums or bass), so a target can never be hidden. Redo opens an existing row as current; it does not alter pattern events.
- **Acceptance:** user can stay on the active row indefinitely, advance only manually, pause/resume from the transport control, restart after final pass, and select a passed row to redo. A bass-only pattern opens guidance in bass projection. Editing while paused visibly resets the guide; editing while guided is blocked.

### 3. Guided visual/audio hierarchy (Priority 9)
- **Goal:** current material is easy to follow while completed material provides quiet musical context.
- **API contract:** scheduled playback receives a pass-state/mix selector per drum pad and bass; UI receives the same state for row/pad classes. Avoid a second transport or timers.
- **Data model:** derive `unreached|active|passed` from current pass index. Do not write it into the pattern.
- **Key decisions:** unreached drum rows/bass are not scheduled; passed rows play at reduced gain; active pass plays foreground gain. Use the existing Tone scheduling path and a small constant gain map, not a mixer UI. Colour is never the only state signal: add row label, opacity, and current-target ring/pulse.
- **Acceptance:** in a three-row guide, first row is foreground, later rows are silent, then first becomes quieter as second becomes foreground. Pad echoes the active scheduled target. Audio/pad REC are disabled during guided state.

## Tracker

| # | User story | Status | Session | Notes |
|---|-----------|--------|---------|-------|
| 1 | Derived row-by-row guide | Done | 2026-07-15 | Pure `derivePasses` order and visible guidance list verified for empty and populated patterns; no guide metadata is persisted. |
| 2 | Next, restart, redo, and restart-on-edit | Done | 2026-07-15 | Ephemeral compose/guided/paused/complete lifecycle, manual Next/Restart/Redo, guided edit lock, paused/complete restart-on-edit, and REC/mode safeguards verified. |
| 3 | Guided visual/audio hierarchy | Done | 2026-07-15 | Shared derived active/passed/unreached state drives row labels/classes, pad echoes, and scheduled gain; unreached material is silent and passed context is -12 dB. |
