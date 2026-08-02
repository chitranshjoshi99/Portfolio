import LayerStack from "./LayerStack";
import type { Pass } from "../lib/guidance";

export default function LessonPanel({
  guideStatus,
  guideLabel,
  passes,
  currentIndex,
  onStartGuidance,
  onNextGuidance,
  onRestartGuidance,
  onStopLesson,
  onRedoPass,
  onResetPattern,
  onOpenDraft,
  // guideNotice,
}: {
  guideStatus: "compose" | "guided" | "paused" | "complete";
  guideLabel: string;
  passes: readonly Pass[];
  currentIndex: number;
  onStartGuidance: () => void;
  onNextGuidance: () => void;
  onRestartGuidance: () => void;
  onStopLesson: () => void;
  onRedoPass: (pass: Pass) => void;
  onResetPattern: () => void;
  onOpenDraft: () => void;
  // guideNotice: string | null;
}) {
  return (
    <section className="deck__lesson" aria-label="Lesson actions">
      <div className="deck__heading">
        <span>Lesson actions</span>
        <small>
          {guideStatus === "compose"
            ? "ready when the score has content"
            : guideLabel}
        </small>
      </div>
      <LayerStack
        passes={passes}
        status={guideStatus}
        currentIndex={currentIndex}
        onStartGuidance={onStartGuidance}
        onNextGuidance={onNextGuidance}
        onRestartGuidance={onRestartGuidance}
        onStopLesson={onStopLesson}
        onRedoPass={onRedoPass}
        onResetPattern={onResetPattern}
        onOpenDraft={onOpenDraft}
      />
      {/* {guideNotice && (
        <p className="guidance-notice" role="status" aria-live="polite">
          {guideNotice}
        </p>
      )} */}
    </section>
  );
}
