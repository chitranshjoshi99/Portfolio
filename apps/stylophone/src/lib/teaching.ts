// Teaching progression — the pure seam for layer-by-layer lessons (EPIC-4).
// A lesson teaches one layer at a time over lesson.teachOrder (e.g. ["drums","bass"]):
// completed layers keep playing (dim), the current one is cued (bright), later ones locked.
// `index` is the position of the CURRENT layer: -1 = not started, >= length = all done.
// PURE: no side effects, no DOM/audio; just array logic over (teachOrder, index).

// completed + current = teachOrder up to and including index.
export function activeLayers(teachOrder: string[], index: number): string[] {
  return teachOrder.slice(0, index + 1);
}

// The layer currently being taught, or null when out of range.
export function currentLayer(teachOrder: string[], index: number): string | null {
  return teachOrder[index] ?? null;
}

// A layer's state relative to the current index. Not in teachOrder => locked.
export function layerState(
  teachOrder: string[],
  index: number,
  layer: string
): "locked" | "active" | "done" {
  const i = teachOrder.indexOf(layer);
  if (i === -1 || i > index) return "locked";
  if (i === index) return "active";
  return "done";
}

// --- pure self-check (no DOM/audio). Guarded off the render path. ---
export function _selfcheck(): void {
  const order = ["drums", "bass"];

  console.assert(activeLayers(order, -1).join() === "", "activeLayers -1 empty");
  console.assert(activeLayers(order, 0).join() === "drums", "activeLayers 0");
  console.assert(activeLayers(order, 1).join() === "drums,bass", "activeLayers 1");

  console.assert(currentLayer(order, -1) === null, "currentLayer -1 null");
  console.assert(currentLayer(order, 0) === "drums", "currentLayer 0");
  console.assert(currentLayer(order, 1) === "bass", "currentLayer 1");
  console.assert(currentLayer(order, 2) === null, "currentLayer 2 null");

  console.assert(layerState(order, 0, "drums") === "active", "layerState 0 drums active");
  console.assert(layerState(order, 0, "bass") === "locked", "layerState 0 bass locked");
  console.assert(layerState(order, 1, "drums") === "done", "layerState 1 drums done");
  console.assert(layerState(order, 1, "bass") === "active", "layerState 1 bass active");
  console.assert(layerState(order, 0, "guitar") === "locked", "layerState unknown locked");
}
