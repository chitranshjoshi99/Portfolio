import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import "./style.css";

// ponytail: fixed star field — deterministic positions from index, not Math.random(),
// so the layout never shifts between renders/remounts.
const STAR_COUNT = 40;
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  x: (i * 13.7) % 100,
  y: (i * 29.3 + i * i * 0.7) % 100,
  size: 1 + (i % 3), // 1-3px
  twinkle: i % 13 === 0, // a handful twinkle
  delay: (i * 0.37) % 4,
  dur: 2.5 + (i % 4) * 0.6,
}));

// ponytail: fixed cloud layout — same determinism precedent as STARS, tiny fixed array
// instead of Math.random(), so clouds never jump between renders/remounts.
const CLOUDS = [
  { x: 8, y: 14, scale: 1 },
  { x: 62, y: 8, scale: 1.3 },
  { x: 78, y: 28, scale: 0.8 },
  { x: 30, y: 22, scale: 0.9 },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function SpaceBackground() {
  const { isDark } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={`space-bg ${isDark ? "space-bg--dark" : "space-bg--light"}${reducedMotion ? " space-bg--reduced-motion" : ""}`}
      aria-hidden="true"
    >
      {isDark ? (
        <>
          {STARS.map((s, i) => (
            <span
              key={i}
              className={`space-bg__star${s.twinkle ? " space-bg__star--twinkle" : ""}`}
              style={
                {
                  "--star-x": `${s.x}%`,
                  "--star-y": `${s.y}%`,
                  "--star-size": `${s.size}px`,
                  "--star-delay": `${s.delay}s`,
                  "--star-dur": `${s.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}

          {/* Small pixel-art moon — blocky rect cluster forming a circle silhouette */}
          <svg
            className="space-bg__moon"
            viewBox="0 0 16 16"
            shapeRendering="crispEdges"
          >
            <rect x="6" y="2" width="4" height="1" />
            <rect x="4" y="3" width="8" height="1" />
            <rect x="3" y="4" width="10" height="1" />
            <rect x="2" y="5" width="12" height="6" />
            <rect x="3" y="11" width="10" height="1" />
            <rect x="4" y="12" width="8" height="1" />
            <rect x="6" y="13" width="4" height="1" />
            {/* craters */}
            <rect
              x="5"
              y="6"
              width="2"
              height="2"
              className="space-bg__moon-crater"
            />
            <rect
              x="9"
              y="8"
              width="2"
              height="2"
              className="space-bg__moon-crater"
            />
          </svg>
        </>
      ) : (
        <>
          {/* Pixel-art sun — same rect-cluster circle silhouette technique as the moon */}
          <svg
            className="space-bg__sun"
            viewBox="0 0 16 16"
            shapeRendering="crispEdges"
          >
            <rect x="6" y="2" width="4" height="1" />
            <rect x="4" y="3" width="8" height="1" />
            <rect x="3" y="4" width="10" height="1" />
            <rect x="2" y="5" width="12" height="6" />
            <rect x="3" y="11" width="10" height="1" />
            <rect x="4" y="12" width="8" height="1" />
            <rect x="6" y="13" width="4" height="1" />
          </svg>

          {/* Pixel-art clouds — blocky rect clusters, fixed positions (see CLOUDS array) */}
          {CLOUDS.map((c, i) => (
            <svg
              key={i}
              className="space-bg__cloud"
              viewBox="0 0 24 12"
              shapeRendering="crispEdges"
              style={
                {
                  "--cloud-x": `${c.x}%`,
                  "--cloud-y": `${c.y}%`,
                  "--cloud-scale": c.scale,
                  "--cloud-delay": `${i * 1.3}s`,
                } as React.CSSProperties
              }
            >
              <rect x="4" y="4" width="16" height="1" />
              <rect x="2" y="5" width="20" height="1" />
              <rect x="0" y="6" width="24" height="4" />
              <rect x="2" y="10" width="20" height="1" />
              <rect x="4" y="11" width="16" height="1" />
            </svg>
          ))}
        </>
      )}
    </div>
  );
}
