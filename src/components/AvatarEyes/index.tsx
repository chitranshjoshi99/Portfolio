import { useRef, useEffect, useCallback } from "react";
import "./style.css";

// ── Eye positions (fractions of rendered avatar size) ──────────
// Tune these if the pupils don't land on the eyes in the image.
const LEFT_EYE = { cx: 0.405, cy: 0.445 };
const RIGHT_EYE = { cx: 0.565, cy: 0.445 };

// Pupil overlay dimensions (px at 240px render size; scale with container)
const PUPIL_PX = 6; // pupil square side
const MASK_PX = 20; // white mask square side (covers original pixel pupil)
const MAX_TRAVEL = 4; // max displacement from eye center in px

interface AvatarEyesProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  imgClassName?: string;
}

export function AvatarEyes({
  src,
  alt,
  width = 240,
  height = 240,
  imgClassName,
}: AvatarEyesProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lPupilRef = useRef<HTMLSpanElement>(null);
  const rPupilRef = useRef<HTMLSpanElement>(null);

  const movePupils = useCallback((clientX: number, clientY: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const { left, top, width: w, height: h } = wrap.getBoundingClientRect();
    const cursorX = clientX - left;
    const cursorY = clientY - top;

    for (const [pupilRef, eye] of [
      [lPupilRef, LEFT_EYE],
      [rPupilRef, RIGHT_EYE],
    ] as const) {
      const el = pupilRef.current;
      if (!el) continue;

      const eyeX = eye.cx * w;
      const eyeY = eye.cy * h;
      const dx = cursorX - eyeX;
      const dy = cursorY - eyeY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const travel = Math.min(dist / 40, 1) * MAX_TRAVEL;
      const snapX = Math.round((dx / dist) * travel);
      const snapY = Math.round((dy / dist) * travel);

      el.style.transform = `translate(calc(-50% + ${snapX}px), calc(-50% + ${snapY}px))`;
    }
  }, []);

  const resetPupils = useCallback(() => {
    for (const ref of [lPupilRef, rPupilRef]) {
      if (ref.current) {
        ref.current.style.transform = "translate(-50%, -50%)";
      }
    }
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: MouseEvent) => movePupils(e.clientX, e.clientY);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", resetPupils);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", resetPupils);
    };
  }, [movePupils, resetPupils]);

  const eyes = [
    { key: "l", pos: LEFT_EYE, pupilRef: lPupilRef },
    { key: "r", pos: RIGHT_EYE, pupilRef: rPupilRef },
  ];

  return (
    <div
      ref={wrapRef}
      className="avatar-eyes"
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={imgClassName}
        draggable={false}
      />

      {eyes.map(({ key, pos, pupilRef }) => (
        <span
          key={key}
          className="avatar-eyes__mask"
          style={
            {
              "--eye-cx": `${pos.cx * 100}%`,
              "--eye-cy": `${pos.cy * 100}%`,
              "--mask-px": `${MASK_PX}px`,
            } as React.CSSProperties
          }
          aria-hidden="true"
        >
          <span
            ref={pupilRef}
            className="avatar-eyes__pupil"
            style={
              {
                "--pupil-px": `${PUPIL_PX}px`,
              } as React.CSSProperties
            }
          />
        </span>
      ))}
    </div>
  );
}
