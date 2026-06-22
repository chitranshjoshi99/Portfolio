import { useState } from "react";
import { Link } from "react-router-dom";
import { haptics } from "../../utils/haptics";
import { CodePanel } from "../CodePanel";
import { CodePopup } from "../CodePopup";
import { Handheld } from "../Handheld";
import { useIsMobile } from "../../hooks/useIsMobile";
import { getBlogByGame } from "../../blogs/meta";
import type { LabExperiment } from "../../data/labs";
import "./style.css";

interface Props {
  experiment: LabExperiment;
}

const STATUS_GLYPHS: Record<LabExperiment["status"], string> = {
  RUNNING: "●",
  WRITING: "◎",
  OFFLINE: "◌",
};

export function SceneText({ experiment: exp }: Props) {
  const isMobile = useIsMobile();
  const [showCode, setShowCode] = useState(false);
  const [showPlay, setShowPlay] = useState(false);

  const channelLabel =
    exp.render === "tv" ? `CH ${String(exp.channel).padStart(2, "0")}` : "TOY";

  const filename = `${exp.id}.loop.ts`;
  const post = getBlogByGame(exp.game);

  return (
    <div className="scene-text">
      <div className="scene-text__meta pixel-text">
        <span className="scene-text__channel">{channelLabel}</span>
        <span className="scene-text__badge" style={{ color: exp.accent }}>
          {STATUS_GLYPHS[exp.status]} {exp.status}
        </span>
      </div>

      <h2 className="pixel-text scene-text__title">{exp.title}</h2>
      <p className="vt-text scene-text__teaser">{exp.teaser}</p>

      {isMobile ? (
        /* Mobile: don't render the heavy inline code / TV — gate behind buttons */
        <div className="scene-text__actions">
          <button
            type="button"
            className="btn btn--outline scene-text__action"
            onClick={() => {
              haptics.press();
              setShowCode(true);
            }}
          >
            {"</> SHOW CODE"}
          </button>
          {exp.device === "HH" && (
            <button
              type="button"
              className="btn btn--primary scene-text__action"
              onClick={() => {
                haptics.press();
                setShowPlay(true);
              }}
            >
              ▶ SEE IN ACTION
            </button>
          )}
        </div>
      ) : (
        <div className="scene-text__code-wrap">
          <CodePanel code={exp.code} filename={filename} />
        </div>
      )}

      {post && (
        <Link
          to={`/blogs/${post.slug}`}
          className="pixel-text scene-text__readmore"
          onClick={() => haptics.tap()}
        >
          READ FULL POST →
        </Link>
      )}

      {showCode && (
        <CodePopup
          code={exp.code}
          filename={filename}
          accent={exp.accent}
          onClose={() => setShowCode(false)}
        />
      )}
      {showPlay && exp.device === "HH" && (
        <Handheld experiment={exp} onClose={() => setShowPlay(false)} />
      )}
    </div>
  );
}
