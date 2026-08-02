import { forwardRef } from "react";
import { EXPERIENCE } from "../../data/resume";
import type { Experience } from "../../data/resume";
import "./style.css";

export interface ExpCardProps {
  exp: Experience;
  index: number;
  isActive: boolean;
}

// Must use forwardRef so the parent (About page) can store the DOM node
// in cardRefs for the IntersectionObserver.
// React 18 silently drops `ref` passed as a plain prop to a function component.
const ExperienceCard = forwardRef<HTMLElement, ExpCardProps>(
  function ExperienceCard({ exp, index, isActive }, ref) {
    const isEven = index % 2 === 0;

    return (
      <section
        className={`exp-card exp-card--${exp.id} ${isActive ? "exp-card--active" : ""}`}
        ref={ref as React.Ref<HTMLElement>}
        style={
          {
            "--exp-accent": exp.accentHex,
            "--exp-accent-dim": exp.accentHex + "22",
            // "--exp-bg": exp.bgHex,
          } as React.CSSProperties
        }
        aria-label={`${exp.companyFull} experience`}
      >
        {/* Subtle tinted background overlay — activates on active card */}
        <div className="exp-card__bg-overlay" aria-hidden="true" />

        <div
          className={`container exp-card__inner ${isEven ? "" : "exp-card__inner--reverse"}`}
        >
          {/* ── Left: company info ───────────────────────── */}
          <div className="exp-panel exp-panel--left">
            <div className="exp-company">
              <p className="exp-company__index pixel-text">
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(EXPERIENCE.length).padStart(2, "0")}
              </p>
              <h2 className="exp-company__name pixel-text">{exp.company}</h2>
              <p className="exp-company__full">{exp.companyFull}</p>
              <p className="exp-company__role pixel-text">{exp.role}</p>

              <div className="exp-meta">
                <span className="exp-meta__chip pixel-text">
                  📅 {exp.period}
                </span>
                <span className="exp-meta__chip pixel-text">
                  📍 {exp.location}
                </span>
              </div>

              <p className="exp-summary">{exp.summary}</p>
            </div>

            <div className="exp-tags">
              {exp.tags.map((tag) => (
                <span key={tag} className="exp-tag pixel-text">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right: achievements ──────────────────────── */}
          <div className="exp-panel exp-panel--right">
            <p className="exp-achievements__title pixel-text">▸ ACHIEVEMENTS</p>
            <ul className="exp-achievements" role="list">
              {exp.achievements.map((a, j) => (
                <li
                  key={j}
                  className={`exp-achievement ${isActive ? "exp-achievement--visible" : ""}`}
                  style={{ transitionDelay: `${100 + j * 70}ms` }}
                >
                  <span
                    className="exp-achievement__icon pixel-text"
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  <div className="exp-achievement__body">
                    <div className="exp-achievement__top">
                      <span className="exp-achievement__label pixel-text">
                        {a.label}
                      </span>
                      {a.metric && (
                        <span className="exp-achievement__metric vt-text">
                          {a.metric}
                        </span>
                      )}
                    </div>
                    <span className="exp-achievement__text">{a.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Corner pixel accents */}
        <div
          className="exp-card__corner exp-card__corner--tl"
          aria-hidden="true"
        />
        <div
          className="exp-card__corner exp-card__corner--br"
          aria-hidden="true"
        />
      </section>
    );
  },
);

export default ExperienceCard;
