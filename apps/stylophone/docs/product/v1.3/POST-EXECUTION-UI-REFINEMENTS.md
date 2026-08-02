# v1.3 post-execution UI refinements

These refinements followed the v1.3 epic execution. They preserve the grid-first
desktop workstation while making its feedback and sizing reliable across horizontal
viewports and browser zoom levels.

## Visualizer and keyboard feedback

- Keyboard pad input now travels through the Visualizer before reaching the Grid's
  existing sound authority. The pressed wedge therefore flashes for keyboard input,
  while the Grid remains the only sound producer and continues to deduplicate drum
  triggers.
- The Visualizer has an always-available expand/restore control beside its heading.
  The expanded state reallocates both width and height from the surrounding cards,
  so the circular pad actually becomes larger rather than leaving a wide empty panel.
- Expansion is animated with a short layout transition and pad spring. Reduced-motion
  users receive the same final layout without the animation.

## Viewport-relative workstation sizing

- The header, score, and deck use viewport-relative tracks; cards size their contents
  from their own containers rather than fixed component dimensions.
- Expanding the Visualizer temporarily compresses the status and score cards. The
  score remains contained and the app does not gain horizontal overflow.
- The tempo dial, its indicator, replay control, metronome dots, and pass summary all
  scale or compact within the status bar. The indicator derives its geometry from the
  dial, so it cannot extend beyond the circular control. The pass summary truncates
  safely when space is exceptionally tight.

## Guidance and walkthrough polish

- The Visualizer resize is deliberately **not** gated by guidance: it is useful while
  composing and practising, so it stays available in every mode.
- The transient inline guidance notice is intentionally hidden to keep Lesson Actions
  focused on the pass list and controls.
- The first-visit walkthrough now uses task-oriented copy: start the clock, print a
  groove, capture with REC, enter guidance, and practise on the Visualizer. It keeps
  the first guided pass active for practice instead of auto-advancing through passes.

## Verification

- `npm run build` passes.
- Visual checks at 1280×720 confirmed that the expanded deck and circular pad grow in
  both dimensions, the status-bar controls stay inside their container, and the page
  has no horizontal overflow.
