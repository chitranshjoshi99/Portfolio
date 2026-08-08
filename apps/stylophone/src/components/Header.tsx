import TempoKnob from "./TempoKnob";
import BeatIndicator from "./BeatIndicator";
import type { Mode } from "../lib/constants";

export default function Header({
  bpm,
  onBpmChange,
  mode,
  selectedSound,
  beat,
  playing,
  guideLabel,
  passSummary,
  onReplayTour,
}: {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  mode: Mode;
  selectedSound: string;
  beat: number;
  playing: boolean;
  guideLabel: string;
  passSummary: string;
  onReplayTour: () => void;
}) {
  return (
    <header className="workspace__header" aria-label="Live status">
      <div className="header__info">
        <TempoKnob bpm={bpm} onBpmChange={onBpmChange} />
        <strong>{bpm} BPM</strong>
        <span>
          {mode === "drums" ? "Drums" : "Bass"} / {selectedSound}
        </span>
      </div>
      <div className="header__brand">
        <span>Beats Drum Machine Coach</span>
        <small>two bars · 64 steps · hardware companion</small>
        <small className="header__disclaimer">
          Not affiliated with or endorsed by Dubreq Ltd.
        </small>
      </div>
      <div className="header__progress">
        <div className="header__progress-top">
          <button
            type="button"
            className="tbtn header__replay"
            aria-label="Replay walkthrough tour"
            title="Replay walkthrough tour"
            onClick={onReplayTour}
          >
            ?
          </button>
          <BeatIndicator beat={beat} playing={playing} />
        </div>
        <span className="header__pass" role="status" aria-live="polite">
          {guideLabel} · {passSummary}
        </span>
      </div>
    </header>
  );
}
