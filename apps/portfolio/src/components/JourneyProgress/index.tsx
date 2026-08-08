import { useEffect, useRef, useState } from "react";
import "./style.css";

interface JourneyProgressItem {
  id: string;
  company: string;
  accentHex: string;
  period: string;
}

interface JourneyProgressProps {
  items: JourneyProgressItem[];
  activeIdx: number;
  onDotClick: (i: number) => void;
}

export default function JourneyProgress({
  items,
  activeIdx,
  onDotClick,
}: JourneyProgressProps) {
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (showTimeoutRef.current) window.clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);

    setRevealedIndices([]);

    showTimeoutRef.current = window.setTimeout(() => {
      setRevealedIndices([activeIdx]);
    }, 500);

    hideTimeoutRef.current = window.setTimeout(() => {
      setRevealedIndices([]);
    }, 1200);

    return () => {
      if (showTimeoutRef.current) window.clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, [activeIdx, items.length]);

  return (
    <div className="journey-progress" aria-label="Experience progress">
      <div className="journey-progress__track">
        <div
          className="journey-progress__fill"
          style={{ height: `${((activeIdx + 1) / items.length) * 100}%` }}
        />
      </div>

      {items.map((item, i) => (
        <button
          key={item.id}
          className={`jp-dot ${activeIdx === i ? "jp-dot--active" : ""} ${activeIdx > i ? "jp-dot--past" : ""} ${revealedIndices.includes(i) ? "jp-dot--revealed" : ""}`}
          style={{ "--dot-color": item.accentHex } as React.CSSProperties}
          onClick={() => onDotClick(i)}
          aria-label={item.company}
          title={item.company}
        >
          <span className="jp-dot__ring" />
          <span className="jp-dot__fill" />
          <span className="jp-dot__tooltip pixel-text">
            <span className="jp-dot__tooltip-name">{item.company}</span>
            <span className="jp-dot__tooltip-period">{item.period}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
