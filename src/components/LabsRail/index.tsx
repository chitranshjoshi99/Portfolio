import { Fragment, type CSSProperties } from "react";
import { haptics } from "../../utils/haptics";
import type { LabExperiment } from "../../data/labs";
import "./style.css";

interface Props {
  activeIdx: number; // 0 = hero/INIT, 1..N = experiments
  experiments: LabExperiment[]; // full ordered list (tv first, toys after)
  onJump: (idx: number) => void;
}

const STATUS_GLYPH: Record<LabExperiment["status"], string> = {
  RUNNING: "●",
  WRITING: "◎",
  OFFLINE: "◌",
};

export function LabsRail({ activeIdx, experiments, onJump }: Props) {
  const jump = (idx: number) => {
    haptics.tap();
    onJump(idx);
  };

  let lastRender: LabExperiment["render"] | null = null;

  return (
    <nav className="labs-rail" aria-label="Lab sections">
      <ul className="labs-rail__list">
        {/* INIT / hero */}
        <li>
          <button
            className={`labs-rail__item labs-rail__item--init${activeIdx === 0 ? " is-active" : ""}`}
            onClick={() => jump(0)}
            aria-current={activeIdx === 0 ? "true" : undefined}
            aria-label="Go to Labs intro"
          >
            <span className="labs-rail__dot" aria-hidden="true" />
            <span className="labs-rail__label">
              <span className="labs-rail__tag">INIT</span>
              <span className="labs-rail__name vt-text">boot</span>
            </span>
          </button>
        </li>

        {experiments.map((exp, i) => {
          const idx = i + 1;
          const isActive = activeIdx === idx;
          const showHeader = exp.render !== lastRender;
          lastRender = exp.render;
          const tag =
            exp.render === "tv"
              ? `CH${String(exp.channel).padStart(2, "0")}`
              : "TOY";
          return (
            <Fragment key={exp.id}>
              {showHeader && (
                <li className="labs-rail__sep" aria-hidden="true">
                  <span className="labs-rail__sep-label pixel-text">
                    {exp.render === "tv" ? "TV" : "TOYS"}
                  </span>
                </li>
              )}
              <li>
                <button
                  className={`labs-rail__item${isActive ? " is-active" : ""}`}
                  style={{ "--row-accent": exp.accent } as CSSProperties}
                  onClick={() => jump(idx)}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`Go to ${exp.title}`}
                >
                  <span className="labs-rail__dot" aria-hidden="true" />
                  <span className="labs-rail__label">
                    <span className="labs-rail__tag">{tag}</span>
                    <span className="labs-rail__name vt-text">{exp.id}</span>
                    <span className="labs-rail__status" aria-hidden="true">
                      {STATUS_GLYPH[exp.status]}
                    </span>
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}
