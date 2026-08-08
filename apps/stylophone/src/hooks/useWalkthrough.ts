import { useEffect, useRef, useState } from "react";
import { DEMO_GROOVE } from "../lib/demoGroove";
import { hasSeenWalkthrough, markWalkthroughSeen } from "../lib/storage";
import { emptyPattern, type Pattern } from "../lib/pattern";

const DEMO_BPM = 100;

export type TourStep = {
  label: string;
  selector: string;
  copy: string;
  // Caption card corner. Lesson Control and Visualizer sit at the bottom of
  // the deck, right where the default bottom-right caption would land on top
  // of them, so those two steps move the caption to the top-right instead.
  captionCorner?: "top-right" | "bottom-right";
};

// Fixed, always-present targets with no dynamic DOM discovery.
export const TOUR_STEPS: readonly TourStep[] = [
  {
    label: "Your groove at a glance",
    selector: '[aria-label="Live status"]',
    copy: "Set the tempo, follow the beat, and check whether you are composing or practising from here.",
  },
  {
    label: "Start the clock",
    selector: '[aria-label="Control rail"]',
    copy: "Choose Drums or Bass, select a sound, then use Play and the metronome to hear the loop. The walkthrough has started a 100 BPM click for you.",
  },
  {
    label: "Print a drum groove",
    selector: '[aria-label="Pattern score"]',
    copy: "Click or tap a cell to add a hit. Drag across one drum row to paint a run, or drag from a lit cell to erase. Use the fill button beside any drum row for an instant pattern.",
  },
  {
    label: "Capture with confidence",
    selector: '[aria-label="Control rail"]',
    copy: "Turn on REC and play a pad to print it into the nearest grid step. Every tap and sequenced note shares one sound path, so a hit exactly on the beat stays clean instead of doubling.",
  },
  {
    label: "Build the full loop",
    selector: '[aria-label="Pattern score"]',
    copy: "This is a two-bar, 64-step score. Switch to Bass to place pitched notes, then drag from a bass note to extend it. Your drum and bass layers keep playing together.",
  },
  {
    label: "Enter guidance",
    selector: '[aria-label="Lesson actions"]',
    copy: "Start guidance when your groove is ready. It selects one populated row at a time and keeps the score locked while you practise. This demo is now guiding its first row.",
    captionCorner: "top-right",
  },
  {
    label: "Practise on the Visualizer",
    selector: '[aria-label="Visualizer pad"]',
    copy: "Follow the lit pad and tap it in time with the loop. A correct hit flashes green and a miss flashes red, so you can practise directly on screen or mirror the same movement on your hardware.",
    captionCorner: "top-right",
  },
  {
    label: "Keep the groove moving",
    selector: '[aria-label="Lesson actions"]',
    copy: "Use Next row when you are ready for the next part. Pause with the transport, redo a passed row from this list, or continue editing after the lesson is complete.",
    captionCorner: "top-right",
  },
];

// The demo unfolds in stages keyed to the tour step. It uses the same compose
// and guidance actions as the product, then leaves the first pass active so
// the Visualizer step is an actual practice moment rather than a static demo.
export function useWalkthrough(
  commitPatternEdit: (mutator: (pattern: Pattern) => Pattern) => boolean,
  startGuidance: () => void,
  setGuideCompose: (notice?: string) => void,
  setBpm: (bpm: number) => void,
  clickEnabled: boolean,
  onToggleClick: () => void,
  playing: boolean,
  onTogglePlay: () => Promise<void>,
) {
  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null);

  function startTour() {
    setTourStepIndex(0);
  }

  function nextTourStep() {
    setTourStepIndex((index) => {
      if (index === null) return null;
      const next = index + 1;
      return next >= TOUR_STEPS.length ? null : next;
    });
  }

  function skipTour() {
    setTourStepIndex(null);
  }

  // Stage effect: runs after the render that moved tourStepIndex. Stage actions
  // only ever fire on a transition, never on re-renders at the same step.
  const prevTourIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevTourIndexRef.current;
    prevTourIndexRef.current = tourStepIndex;
    if (tourStepIndex === prev) return;

    if (tourStepIndex === 0) {
      // Step 1: show an empty composer before introducing the controls.
      setBpm(DEMO_BPM);
      commitPatternEdit(() => emptyPattern());
      if (clickEnabled) onToggleClick();
      if (playing) void onTogglePlay();
    } else if (tourStepIndex === 1) {
      // Step 2: metronome on, transport starts. The grid remains empty.
      if (!clickEnabled) onToggleClick();
      if (!playing) void onTogglePlay();
    } else if (tourStepIndex === 2) {
      // Step 3: make the new grid interactions concrete with a real groove.
      commitPatternEdit(() => DEMO_GROOVE);
    } else if (tourStepIndex === 5) {
      // Step 6: guidance deliberately stays on the first row. The user can
      // practise it on the Visualizer before explicitly advancing.
      startGuidance();
    } else if (tourStepIndex === null && prev !== null) {
      // Tour finished or skipped: the grid stays painted, transport pauses.
      if (playing) void onTogglePlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStepIndex]);

  // Ref kept current every render so the one-time first-gesture listener and
  // the replay action always call the latest closure. A real gesture is needed
  // to unlock audio, so the demo cannot start on mount.
  const retriggerRef = useRef(retriggerTour);
  retriggerRef.current = retriggerTour;

  function retriggerTour() {
    // Compose state first: the step-1 stage clears the grid via
    // commitPatternEdit, which rejects edits while guidance is "guided" (a
    // replay can be clicked mid-demo).
    setGuideCompose();
    startTour();
  }

  // First-visit auto-launch: once per browser, wait for the first click to
  // unlock audio, then begin the spotlight tour.
  useEffect(() => {
    if (hasSeenWalkthrough()) return;
    function handleFirstGesture() {
      markWalkthroughSeen();
      retriggerRef.current();
    }
    window.addEventListener("click", handleFirstGesture, { once: true });
    return () => window.removeEventListener("click", handleFirstGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tourStepIndex, startTour, nextTourStep, skipTour, retriggerTour };
}
