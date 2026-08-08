# R2 — Twelve-pad integration

**Status:** Done

## Result

The drum editor now renders all twelve physical `PAD_IDS` rows, labels every row from `DRUM_BY_PAD`, and edits the exact `PadId` selected. Teaching dimming now classifies all twelve drum rows as the drum layer. The temporary coarse three-class editor adapter was removed; recording, playback, persistence, cues, and hit checks therefore retain the same exact pad identity end-to-end.

## Files changed

- `src/App.tsx`
- `src/StepGrid.tsx`

## Verification

| Check | Result |
|---|---|
| `npm run build` | Passed. |
| `git diff --check` | Passed. |
| Runtime source search for `canonicalPadForReduction`, `DrumReductionClass`, `padDrum`, and coarse `drums.kick/snare/hat` accesses | No matches in App, grid, audio, hit, pad, or pattern runtime files. |

## Remaining UAT limitation

No browser screenshot or audible check was performed in this terminal-only session. CSS geometry and mode-projected BASS layout remain R8 scope; full visual/audio regression remains R11.
