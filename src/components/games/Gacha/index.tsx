import { useEffect, useRef, useState } from "react";
import { haptics } from "../../../utils/haptics";
import type { GameProps } from "../types";
import "./style.css";

const SYMBOLS = ["◈", "◆", "◉", "●", "◎", "▲", "▼", "★"];

const RARITIES = [
  { name: "LEGENDARY", symbol: "◈", prob: 0.05, color: "var(--nivoda-gold)" },
  { name: "EPIC", symbol: "◆", prob: 0.15, color: "var(--classplus-purple)" },
  { name: "RARE", symbol: "◉", prob: 0.3, color: "var(--delhivery-red)" },
  { name: "COMMON", symbol: "●", prob: 0.5, color: "var(--text-muted)" },
] as const;

type GachaPhase = "idle" | "spinning" | "result";

function pickRarity() {
  const r = Math.random();
  let cum = 0;
  for (const rar of RARITIES) {
    cum += rar.prob;
    if (r < cum) return rar;
  }
  return RARITIES[3];
}

function randSym() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export function Gacha({ active }: GameProps) {
  const [phase, setPhase] = useState<GachaPhase>("idle");
  const [reels, setReels] = useState<string[]>(["●", "●", "●"]);
  const [result, setResult] = useState<(typeof RARITIES)[number] | null>(null);
  const [pulls, setPulls] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spinInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (spinInterval.current) {
      clearInterval(spinInterval.current);
      spinInterval.current = null;
    }
  };
  useEffect(() => clearAll, []);

  // Reset when going inactive (so next visit starts fresh)
  useEffect(() => {
    if (!active) {
      clearAll();
      setPhase("idle");
      setReels(["●", "●", "●"]);
      setResult(null);
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePull = () => {
    if (phase !== "idle") return;
    haptics.press();
    const picked = pickRarity();

    setPhase("spinning");
    setResult(null);

    // Spin all reels during animation
    spinInterval.current = setInterval(() => {
      setReels([randSym(), randSym(), randSym()]);
    }, 80);

    // Stop reel 1
    const t1 = setTimeout(() => {
      setReels((prev) => [picked.symbol, prev[1], prev[2]]);
    }, 700);

    // Stop reel 2
    const t2 = setTimeout(() => {
      setReels((prev) => [prev[0], picked.symbol, prev[2]]);
    }, 1050);

    // Stop reel 3 + show result
    const t3 = setTimeout(() => {
      clearInterval(spinInterval.current!);
      spinInterval.current = null;
      setReels([picked.symbol, picked.symbol, picked.symbol]);
      setResult(picked);
      setPhase("result");
      haptics.reveal();
      setPulls((n) => n + 1);
    }, 1400);

    timers.current.push(t1, t2, t3);
  };

  const handleReset = () => {
    clearAll();
    haptics.tap();
    setPhase("idle");
    setReels(["●", "●", "●"]);
    setResult(null);
  };

  return (
    <div className="gacha">
      {/* Machine body */}
      <div className="gacha__machine">
        {/* Title plate */}
        <div className="gacha__plate pixel-text">GACHA_v1.exe</div>

        {/* Reel display */}
        <div
          className="gacha__display"
          aria-live="polite"
          aria-label="Slot reels"
        >
          <div className="gacha__reels">
            {reels.map((sym, i) => (
              <div
                key={i}
                className={`gacha__reel${phase === "spinning" ? " gacha__reel--spinning" : ""}`}
                style={
                  { "--reel-delay": `${i * 0.04}s` } as React.CSSProperties
                }
                aria-hidden="true"
              >
                <span
                  className="vt-text gacha__symbol"
                  style={result ? { color: result.color } : undefined}
                >
                  {sym}
                </span>
              </div>
            ))}
          </div>

          {/* Result line */}
          <div className="gacha__result-line" aria-hidden="true" />

          {/* Rarity badge */}
          <div
            className={`pixel-text gacha__rarity${result ? " gacha__rarity--visible" : ""}`}
            style={result ? { color: result.color } : undefined}
            aria-live="assertive"
          >
            {result ? result.name : " "}
          </div>
        </div>

        {/* Coin slot aesthetic */}
        <div className="gacha__coin-slot" aria-hidden="true">
          <span className="pixel-text">INSERT COIN</span>
          <div className="gacha__slot-hole" />
        </div>

        {/* Controls */}
        <div className="gacha__controls">
          <button
            className="pixel-text gacha__pull-btn"
            onClick={handlePull}
            disabled={phase !== "idle"}
            aria-label="Pull the gacha lever"
          >
            {phase === "spinning" ? "◌ SPINNING" : "[ PULL ]"}
          </button>
          {phase === "result" && (
            <button
              className="pixel-text gacha__retry-btn"
              onClick={handleReset}
              aria-label="Pull again"
            >
              ↺ AGAIN
            </button>
          )}
        </div>

        {pulls > 0 && <p className="pixel-text gacha__pulls">PULLS: {pulls}</p>}
      </div>
    </div>
  );
}
