import { useCallback, useEffect, useState } from "react";
import { CodePanel } from "../CodePanel";
import { haptics } from "../../utils/haptics";
import "./style.css";

interface Props {
  code: string;
  filename: string;
  accent: string;
  onClose: () => void;
}

// Keep in sync with the cp-fold exit animation duration in style.css
const CLOSE_MS = 240;

/** Mobile "Show Code" — a terminal that unfolds in 3D as if it sprang up out of
 *  the button, then folds back down on close. Reuses CodePanel for the body. */
export function CodePopup({ code, filename, accent, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  // Play the fold-back animation, then actually unmount.
  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [requestClose]);

  return (
    <div
      className={`code-popup-overlay${closing ? " code-popup-overlay--closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Source: ${filename}`}
      onClick={requestClose}
    >
      <div
        className={`code-popup${closing ? " code-popup--closing" : ""}`}
        style={{ "--cp-accent": accent } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="code-popup__inner">
          <CodePanel code={code} filename={filename} />
        </div>
        <button
          type="button"
          className="pixel-text code-popup__close"
          onClick={() => {
            haptics.tap();
            requestClose();
          }}
        >
          ✕ CLOSE
        </button>
      </div>
    </div>
  );
}
