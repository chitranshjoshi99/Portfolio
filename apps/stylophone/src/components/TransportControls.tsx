import type { ReactNode } from "react";
import type { Bank, Mode, PadMode } from "../lib/constants";
import { BANKS, OCTAVE_MIN, OCTAVE_MAX } from "../lib/constants";
import "./TransportControls.css";
import "./Device.css";

// One icon family: same 24-unit viewBox, same stroke weight, same 20px box.
// ponytail: inline SVG, no icon dependency — four glyphs is not a library.
function Icon({ children, filled }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      className="tbtn__icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

type Props = {
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
  onOctaveChange: (next: number) => void;
  padMode: PadMode;
  onSetPadMode: (mode: "normal" | "pattern" | "transpose") => void;
  transposeEnabled: boolean;
};

// Renders the chassis' five control regions as siblings (a fragment, so they
// land directly in the chassis grid and can be placed by grid-area).
export default function TransportControls({
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
}: Props) {
  const signed = octave >= 0 ? `+${octave}` : `${octave}`;
  const octaveDisabled = mode === "drums";
  const canRecord = guideStatus === "compose";
  const recordTip = canRecord
    ? `REC captures ${mode === "drums" ? "drums" : "bass"} at the playhead`
    : "REC is available only while composing";
  return (
    <>
      {/* MID-LEFT: 2x2 profile selector, ROK / HIP over TEC / BOX. */}
      <div
        className="chassis__profile profile-grid"
        role="group"
        aria-label={`${mode === "drums" ? "Drum" : "Bass"} sound profile`}
      >
        {BANKS.map((bank) => {
          const active = bank === selectedSound;
          const instrument = mode === "drums" ? "drum" : "bass";
          const tip = active ? `${bank} ${instrument} profile` : `Use ${bank} for ${instrument}`;
          return (
            <button
              key={bank}
              type="button"
              className={`tbtn tbtn--bank${active ? " is-active" : ""}`}
              aria-pressed={active}
              aria-label={`Use ${bank} ${instrument} profile`}
              title={tip}
              data-tip={tip}
              onClick={() => onBankChange(bank)}
            >
              {bank}
            </button>
          );
        })}
      </div>

      {/* BELOW THE PAD: horizontal octave axis — down / readout / up, reading
          left to right like the value it changes.
          ponytail: up/down is the v1 octave input; the authentic swipe-across-the
          7↔1-seam gesture is deferred to v1.1. */}
      <div
        className={`chassis__octave octave-stack${octaveDisabled ? " is-disabled" : ""}`}
        role="group"
        aria-label={mode === "bass" ? "Bass grid octave" : "Bass octave"}
        aria-disabled={octaveDisabled}
      >
        <button
          type="button"
          className="tbtn tbtn--icon"
          onClick={() => onOctaveChange(octave - 1)}
          disabled={octaveDisabled || octave <= OCTAVE_MIN}
          aria-label="Octave down"
          title="Octave down"
          data-tip="Octave down"
        >
          −
        </button>
        <span
          className="tbtn tbtn--readout"
          aria-live="polite"
          aria-label={`Octave ${signed}`}
          aria-disabled={octaveDisabled}
        >
          {signed}
        </span>
        <button
          type="button"
          className="tbtn tbtn--icon"
          onClick={() => onOctaveChange(octave + 1)}
          disabled={octaveDisabled || octave >= OCTAVE_MAX}
          aria-label="Octave up"
          title="Octave up"
          data-tip="Octave up"
        >
          +
        </button>
      </div>

      {/* BOTTOM-LEFT: symbol-only transport. State reads by glyph + pressed
          inset as well as the orange fill — never by color alone. */}
      <div className="chassis__transport transport-array" role="group" aria-label="Transport">
        <button
          type="button"
          className={`tbtn tbtn--icon${clickEnabled ? " is-active" : ""}`}
          aria-pressed={clickEnabled}
          aria-label="Metronome click"
          title="Metronome click"
          data-tip={clickEnabled ? "Click on" : "Click off"}
          onClick={onToggleClick}
        >
          <Icon>
            <path d="M9.5 3h5l3.5 18h-12L9.5 3Z" />
            <path d="M6.9 15h10.2" />
            <path d="M12 19 17 8" />
          </Icon>
        </button>
        <button
          type="button"
          className={`tbtn tbtn--icon${isPlaying ? " is-active" : ""}`}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? (guideStatus === "guided" ? "Pause guidance" : "Stop") : (guideStatus === "paused" ? "Resume guidance" : "Play")}
          title={isPlaying ? (guideStatus === "guided" ? "Pause guidance (Space)" : "Stop (Space)") : (guideStatus === "paused" ? "Resume guidance (Space)" : "Play (Space)")}
          data-tip={isPlaying ? (guideStatus === "guided" ? "Pause guidance (Space)" : "Stop (Space)") : (guideStatus === "paused" ? "Resume guidance (Space)" : "Play (Space)")}
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <Icon filled>
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </Icon>
          ) : (
            <Icon filled>
              <path d="M8 4.6 19 12 8 19.4V4.6Z" />
            </Icon>
          )}
        </button>
        <button
          type="button"
          className={`tbtn tbtn--icon tbtn--rec${recording ? " is-active" : ""}`}
          aria-pressed={recording}
          aria-label={canRecord ? `Record ${mode}` : "Record unavailable outside Compose"}
          title={recording ? `Recording ${mode}` : recordTip}
          data-tip={recording ? `Recording ${mode}` : recordTip}
          onClick={onToggleRec}
          disabled={!canRecord}
        >
          <Icon filled>
            <circle cx="12" cy="12" r="6" />
          </Icon>
        </button>
      </div>

      {/* Instrument and pad-edit modes share one compact framed stack. */}
      <div className="chassis__mode-stack">
        <div className="chassis__mode mode-switch" role="group" aria-label="Pad modes">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "drums"}
            className={`tbtn tbtn--mode${mode === "drums" ? " is-active" : ""}`}
            disabled={guideStatus === "guided"}
            onClick={() => onModeChange("drums")}
          >
            DRUMS
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "bass"}
            className={`tbtn tbtn--mode${mode === "bass" ? " is-active" : ""}`}
            disabled={guideStatus === "guided"}
            onClick={() => onModeChange("bass")}
          >
            BASS
          </button>
        </div>

        <div className="chassis__pad-mode pad-mode-switch" role="group" aria-label="Pad edit modes">
          <button
            type="button"
            className="tbtn tbtn--mode"
            aria-pressed={padMode === "pattern"}
            aria-label={padMode === "pattern" ? "Exit Pattern mode" : "Pattern mode"}
            title={padMode === "pattern" ? "Exit Pattern mode (Escape)" : "Choose pattern slots"}
            data-tip={padMode === "pattern" ? "Pattern on · Escape to cancel" : "Pattern slots"}
            onClick={() => onSetPadMode(padMode === "pattern" ? "normal" : "pattern")}
            disabled={guideStatus !== "compose"}
          >
            {/* <Icon>
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </Icon> */}
            Pattern
          </button>
          <button
            type="button"
            className="tbtn tbtn--mode"
            aria-pressed={padMode === "transpose"}
            aria-label={
              padMode === "transpose"
                ? "Exit Transpose mode"
                : transposeEnabled
                  ? "Transpose mode"
                  : "Transpose mode unavailable"
            }
            title={
              padMode === "transpose"
                ? "Exit Transpose mode (Escape)"
                : transposeEnabled
                  ? "Hold a pad to transpose bass"
                  : "Transpose requires playing with a bassline in Compose"
            }
            data-tip={
              padMode === "transpose"
                ? "Transpose on · Escape to cancel"
                : transposeEnabled
                  ? "Hold pad to transpose"
                  : "Play a bassline to enable"
            }
            onClick={() => onSetPadMode(padMode === "transpose" ? "normal" : "transpose")}
            disabled={!transposeEnabled && padMode !== "transpose"}
          >
            {/* <Icon>
              <path d="M5 8h10" />
              <path d="m12 5 3 3-3 3" />
              <path d="M19 16H9" />
              <path d="m12 13-3 3 3 3" />
            </Icon> */}
            Transpose
          </button>
        </div>
      </div>
    </>
  );
}
