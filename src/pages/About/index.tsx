import { useEffect, useRef, useState } from "react";
import { XPBar } from "../../components/XPBar";
import ExperienceCard from "../../components/ExperienceCard";
import JourneyProgress from "../../components/JourneyProgress";
import { PERSON, EXPERIENCE, EDUCATION, SKILLS } from "../../data/resume";
import "./style.css";

// Breakpoint that matches the CSS rule that disables scroll-snap
const MOBILE_BP = 900;

export default function About() {
  const [activeIdx, setActiveIdx] = useState(0);
  const cardRefs = useRef<(HTMLElement | null)[]>([null, null, null]);
  const journeyRef = useRef<HTMLDivElement>(null);

  // Track whether we're on mobile so we pick the correct IntersectionObserver root.
  // On desktop the cards live inside a nested scroll container (journeyRef) so we
  // must pass root: container — otherwise the viewport-root observer never fires.
  // On mobile scroll-snap is disabled and the document scrolls, so root must be
  // null (viewport). We listen to matchMedia so it stays correct on resize.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BP);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const container = journeyRef.current;
    if (!container) return;

    // root: null → viewport (mobile, document scroll)
    // root: container → nested scroll box (desktop)
    const root = isMobile ? null : container;
    const observers: IntersectionObserver[] = [];

    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveIdx(i);
        },
        { root, threshold: 0.5 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [isMobile]); // rebuild observers whenever mobile/desktop flips

  // Scroll within journey-scroll (scrollIntoView scrolls the document, not the container)
  const scrollToCard = (i: number) => {
    const container = journeyRef.current;
    const card = cardRefs.current[i];
    if (!container || !card) return;

    const cardTop =
      card.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;

    container.scrollTo({ top: cardTop, behavior: "smooth" });
  };

  return (
    <main className="about-page">
      {/* ── Profile intro ──────────────────────────────────── */}
      <section className="about-intro" aria-label="About Chitransh">
        <div className="container about-intro__inner">
          <div className="about-intro__text">
            <p className="about-intro__label pixel-text">// PLAYER_PROFILE</p>
            <h1 className="about-intro__name pixel-text">{PERSON.name}</h1>
            <p className="about-intro__role vt-text">{PERSON.tagline}</p>
            <p className="about-intro__bio">{PERSON.bio}</p>

            <div className="edu-card">
              <span className="edu-card__icon" aria-hidden="true">
                🎓
              </span>
              <div>
                <p className="edu-card__degree pixel-text">
                  {EDUCATION.degree}
                </p>
                <p className="edu-card__school">
                  {EDUCATION.school} · {EDUCATION.period}
                </p>
              </div>
            </div>
          </div>

          <div className="about-intro__stats">
            <p className="pixel-text about-intro__stats-title">SKILL_TREE</p>
            <div className="about-stats-grid">
              {SKILLS.slice(0, 8).map((s, i) => (
                <XPBar
                  key={s.label}
                  label={s.label}
                  value={s.xp}
                  color={
                    s.category === "frontend"
                      ? "var(--accent-primary)"
                      : s.category === "data"
                        ? "var(--nivoda-gold)"
                        : s.category === "backend"
                          ? "var(--delhivery-red)"
                          : "var(--classplus-purple)"
                  }
                  delay={i * 70}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Journey heading + company tab nav ─────────────── */}
      <div className="journey-header">
        <div className="container journey-header__inner">
          <div className="journey-header__titles">
            <h2 className="pixel-text journey-header__title">
              <span className="journey-header__prefix">// </span>
              EXPERIENCE.map()
            </h2>
            <p className="journey-header__sub">
              Three companies. Five years. Scroll through.
            </p>
          </div>

          <nav className="journey-tabs" aria-label="Jump to experience">
            {EXPERIENCE.map((exp, i) => (
              <button
                key={exp.id}
                className={`journey-tab ${activeIdx === i ? "journey-tab--active" : ""}`}
                style={{ "--tab-color": exp.accentHex } as React.CSSProperties}
                onClick={() => scrollToCard(i)}
                aria-label={`Go to ${exp.company}`}
                aria-current={activeIdx === i ? "true" : undefined}
              >
                <span className="journey-tab__num pixel-text">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="journey-tab__name pixel-text">
                  {exp.company}
                </span>
                <span className="journey-tab__period">
                  {exp.period.split("–")[0].trim()}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Scroll-snap cards + progress dots ─────────────── */}
      <div className="journey-scroll-wrap">
        <div className="journey-scroll" ref={journeyRef}>
          {EXPERIENCE.map((exp, i) => (
            <ExperienceCard
              key={exp.id}
              exp={exp}
              index={i}
              isActive={activeIdx === i}
              ref={(el: HTMLElement | null) => {
                cardRefs.current[i] = el;
              }}
            />
          ))}
        </div>

        <JourneyProgress
          experiences={EXPERIENCE}
          activeIdx={activeIdx}
          onDotClick={scrollToCard}
        />
      </div>
    </main>
  );
}
