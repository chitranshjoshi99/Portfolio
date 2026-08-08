import TransportControls from "./TransportControls";
import type { Bank, Mode, PadMode } from "../lib/constants";

export default function ControlRail({
  mode,
  onModeChange,
  selectedSound,
  onBankChange,
  isPlaying,
  onTogglePlay,
  recording,
  onToggleRec,
  guideStatus,
  clickEnabled,
  onToggleClick,
  octave,
  onOctaveChange,
  padMode,
  onSetPadMode,
  transposeEnabled,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  selectedSound: Bank;
  onBankChange: (bank: Bank) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  recording: boolean;
  onToggleRec: () => void;
  guideStatus: "compose" | "guided" | "paused" | "complete";
  clickEnabled: boolean;
  onToggleClick: () => void;
  octave: number;
  onOctaveChange: (octave: number) => void;
  padMode: PadMode;
  onSetPadMode: (mode: "normal" | "pattern" | "transpose") => void;
  transposeEnabled: boolean;
}) {
  return (
    <section className="deck__controls" aria-label="Control rail">
      <div className="deck__heading">
        <span>Control rail</span>
        <small>{mode === "drums" ? "drum input" : "bass input"}</small>
      </div>
      <div className="controls-grid">
        <TransportControls
          mode={mode}
          onModeChange={onModeChange}
          selectedSound={selectedSound}
          onBankChange={onBankChange}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          recording={recording}
          onToggleRec={onToggleRec}
          guideStatus={guideStatus}
          clickEnabled={clickEnabled}
          onToggleClick={onToggleClick}
          octave={octave}
          onOctaveChange={onOctaveChange}
          padMode={padMode}
          onSetPadMode={onSetPadMode}
          transposeEnabled={transposeEnabled}
        />
      </div>
    </section>
  );
}
