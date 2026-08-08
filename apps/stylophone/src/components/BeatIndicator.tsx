import { isAccent } from "../lib/transport";
import "./BeatIndicator.css";

export default function BeatIndicator({
  beat,
  playing,
}: {
  beat: number;
  playing: boolean;
}) {
  return (
    <div
      className="beat-indicator"
      role="status"
      aria-label={playing ? `beat ${beat + 1} of 8` : "stopped"}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className={`beat-dot${isAccent(i) ? " beat-dot--down" : ""}${
            i === beat ? " is-current" : ""
          }`}
        />
      ))}
    </div>
  );
}
