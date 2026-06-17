import { TVScreen } from "../TVScreen";
import type { LabExperiment } from "../../data/labs";
import "./style.css";

interface Props {
  activeChannel: number;
  tvExperiments: LabExperiment[];
}

export function TVSet({ activeChannel, tvExperiments }: Props) {
  return (
    <div className="tv-set">
      {/* Antennas */}
      <div className="tv-set__antennas" aria-hidden="true">
        <div className="tv-set__antenna tv-set__antenna--left" />
        <div className="tv-set__antenna tv-set__antenna--right" />
      </div>

      {/* Body */}
      <div className="tv-set__body">
        {/* Screen area */}
        <div className="tv-set__screen-wrap">
          <TVScreen
            activeChannel={activeChannel}
            tvExperiments={tvExperiments}
          />
          <div className="tv-set__scanlines" aria-hidden="true" />
        </div>

        {/* Control panel */}
        <div className="tv-set__controls" aria-hidden="true">
          <div className="tv-set__knob">
            <div className="tv-set__knob-face" />
            <span className="pixel-text tv-set__knob-label">CH</span>
          </div>
          <div className="tv-set__speaker">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="tv-set__speaker-dot" />
            ))}
          </div>
          <div className="tv-set__knob">
            <div className="tv-set__knob-face" />
            <span className="pixel-text tv-set__knob-label">VOL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
