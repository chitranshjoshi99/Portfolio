import { useEffect, useRef, useState } from "react";
import { Snake } from "../games/Snake";
import { Pong } from "../games/Pong";
import { DinoRun } from "../games/DinoRun";
import { haptics } from "../../utils/haptics";
import type { GameAction, GameHandle, GameProps } from "../games/types";
import type { LabExperiment } from "../../data/labs";
import "./style.css";

// Only the arcade (device === 'HH') games are playable in the handheld.
const HH_GAMES: Record<string, React.ComponentType<GameProps>> = {
  snake: Snake,
  pong: Pong,
  dino: DinoRun,
};

interface Props {
  experiment: LabExperiment;
  onClose: () => void;
}

type Send = (action: GameAction, phase: "down" | "up") => void;

// A momentary/held control button. Fires "down" on press, "up" on release.
function PadButton({
  action,
  glyph,
  label,
  className,
  send,
}: {
  action: GameAction;
  glyph: string;
  label: string;
  className: string;
  send: Send;
}) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    send(action, "down");
    haptics.tap();
  };
  const up = () => send(action, "up");
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

export function Handheld({ experiment, onClose }: Props) {
  const controlRef = useRef<GameHandle | null>(null);
  const [running, setRunning] = useState(true);

  const Game = HH_GAMES[experiment.game];
  const scheme = experiment.controls ?? "single";

  const send: Send = (action, phase) => controlRef.current?.input(action, phase);

  // Lock body scroll + close on Escape while the console is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const togglePower = () => {
    haptics.press();
    onClose();
  };

  const toggleRun = () => {
    haptics.toggle();
    setRunning((r) => !r);
  };

  return (
    <div
      className="handheld-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${experiment.title} — playable console`}
      onClick={onClose}
    >
      <div
        className="handheld"
        style={{ "--hh-accent": experiment.accent } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="handheld__top">
          <span className="pixel-text handheld__brand">LABS&nbsp;·&nbsp;HANDHELD</span>
          <span
            className={`handheld__led${running ? " handheld__led--on" : ""}`}
            aria-hidden="true"
          />
        </div>

        <div className="handheld__screen-frame">
          <div className="handheld__screen">
            {Game ? (
              <Game active={running} controlRef={controlRef} />
            ) : (
              <p className="pixel-text handheld__nosignal">NO CARTRIDGE</p>
            )}
            <div className="handheld__scanlines" aria-hidden="true" />
            {!running && (
              <div className="pixel-text handheld__paused" aria-hidden="true">
                PAUSED
              </div>
            )}
          </div>
        </div>

        <p className="pixel-text handheld__game-name">
          {experiment.id.toUpperCase()}
        </p>

        <div className="handheld__controls">
          {/* Direction cluster (hidden for single-button games) */}
          {scheme !== "single" && (
            <div className="handheld__dpad" data-scheme={scheme}>
              <PadButton
                action="up"
                glyph="▲"
                label="Up"
                className="handheld__pad handheld__pad--up"
                send={send}
              />
              {scheme === "dpad" && (
                <>
                  <PadButton
                    action="left"
                    glyph="◀"
                    label="Left"
                    className="handheld__pad handheld__pad--left"
                    send={send}
                  />
                  <span className="handheld__pad-center" aria-hidden="true" />
                  <PadButton
                    action="right"
                    glyph="▶"
                    label="Right"
                    className="handheld__pad handheld__pad--right"
                    send={send}
                  />
                </>
              )}
              <PadButton
                action="down"
                glyph="▼"
                label="Down"
                className="handheld__pad handheld__pad--down"
                send={send}
              />
            </div>
          )}

          {/* Action button — primary play button (jump / select) */}
          <div className="handheld__action-cluster">
            <PadButton
              action="action"
              glyph="A"
              label="Action"
              className="handheld__ab"
              send={send}
            />
          </div>
        </div>

        <div className="handheld__menu">
          <button
            type="button"
            className="pixel-text handheld__btn handheld__btn--start"
            onClick={toggleRun}
          >
            {running ? "❚❚ STOP" : "▶ START"}
          </button>
          <button
            type="button"
            className="pixel-text handheld__btn handheld__btn--power"
            onClick={togglePower}
            aria-label="Power off — close console"
          >
            ⏻ OFF
          </button>
        </div>
      </div>
    </div>
  );
}
