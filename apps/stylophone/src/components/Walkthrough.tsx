import { useEffect, useState } from "react";
import type { TourStep } from "../hooks/useWalkthrough";
import "./Walkthrough.css";

// Dim-only spotlight, hand-rolled (Architect, v1.2): a single box-shadow
// "hole punch" over the current target's measured rect, no tour library, no
// clip-path/SVG mask. getBoundingClientRect on a known, fixed target list.
export default function Walkthrough({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [reducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  useEffect(() => {
    function measure() {
      const el = document.querySelector(step.selector);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.selector]);

  if (!rect) return null;

  const pad = 8;
  const isLastStep = stepIndex + 1 === totalSteps;

  return (
    <div
      className="walkthrough"
      role="dialog"
      aria-label={`Walkthrough step ${stepIndex + 1} of ${totalSteps}: ${step.label}`}
    >
      <div
        className={
          reducedMotion ? "walkthrough__highlight walkthrough__highlight--instant" : "walkthrough__highlight"
        }
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
      <div
        className={
          step.captionCorner === "top-right"
            ? "walkthrough__caption walkthrough__caption--top"
            : "walkthrough__caption"
        }
      >
        <p className="walkthrough__step-count">
          {stepIndex + 1} / {totalSteps} · {step.label}
        </p>
        <p className="walkthrough__copy">{step.copy}</p>
        <div className="walkthrough__actions">
          <button type="button" className="tbtn" onClick={onSkip}>
            Skip
          </button>
          <button type="button" className="tbtn" onClick={onNext}>
            {isLastStep ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
