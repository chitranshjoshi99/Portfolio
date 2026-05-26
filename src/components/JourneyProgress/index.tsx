import { EXPERIENCE } from "../../data/resume";
import "./style.css";

interface JourneyProgressProps {
  experiences: typeof EXPERIENCE;
  activeIdx: number;
  onDotClick: (i: number) => void;
}

export default function JourneyProgress({
  experiences,
  activeIdx,
  onDotClick,
}: JourneyProgressProps) {
  return (
    <div className="journey-progress" aria-label="Experience progress">
      {/* Vertical track line */}
      <div className="journey-progress__track">
        <div
          className="journey-progress__fill"
          style={{ height: `${((activeIdx + 1) / experiences.length) * 100}%` }}
        />
      </div>

      {experiences.map((exp, i) => (
        <button
          key={exp.id}
          className={`jp-dot ${activeIdx === i ? "jp-dot--active" : ""} ${activeIdx > i ? "jp-dot--past" : ""}`}
          style={{ "--dot-color": exp.accentHex } as React.CSSProperties}
          onClick={() => onDotClick(i)}
          aria-label={exp.company}
          title={exp.company}
        >
          <span className="jp-dot__ring" />
          <span className="jp-dot__fill" />
          <span className="jp-dot__tooltip pixel-text">
            <span className="jp-dot__tooltip-name">{exp.company}</span>
            <span className="jp-dot__tooltip-period">{exp.period}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
