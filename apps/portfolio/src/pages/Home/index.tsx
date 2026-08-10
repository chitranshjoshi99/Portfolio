import { useRef, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTypewriter } from "../../hooks/useTypewriter";
import { StatCard } from "../../components/StatCard";
import { XPBar } from "../../components/XPBar";
import { haptics } from "../../utils/haptics";
import { PERSON, STATS, SKILLS } from "../../data/resume";
import "./style.css";
import { asset } from "@/assets";
import { AvatarEyes } from "../../components/AvatarEyes";

// ── Closing section nav ──────────────────────────────────────
const NEXT_LINKS = [
  {
    to: "/about",
    title: "EXPERIENCE",
    desc: "5+ years across logistics, B2B marketplaces and edtech.",
  },
  {
    to: "/labs",
    title: "LABS",
    desc: "Live interactive experiments, each with its own source.",
  },
  {
    to: "/blogs",
    title: "BLOG",
    desc: "Write-ups on what I have been building and why.",
  },
  {
    to: "/apps",
    title: "APPS",
    desc: "Standalone tools and experiments I have shipped.",
  },
];

export default function Home() {
  const snapRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaInView, setCtaInView] = useState(false);
  const [ctaPressed, setCtaPressed] = useState(false);
  const navigate = useNavigate();

  // Track when the closing section enters the viewport
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setCtaInView(entry.isIntersecting),
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ENTER fires the closing CTA while that section is in view, but never
  // while the user is typing or has focus on another interactive element.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !ctaInView || ctaPressed) return;
      const focused = document.activeElement;
      if (focused && focused !== document.body) return;
      e.preventDefault();
      setCtaPressed(true);
      haptics.press();
      // Brief visual "press" before navigating
      setTimeout(() => navigate("/contact"), 320);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [ctaInView, ctaPressed, navigate]);

  // Typewriter for the hero role line
  const { displayed: typedRole, done: roleDone } = useTypewriter(
    PERSON.tagline,
    { delay: 800, speed: 50 },
  );

  // Secondary typewriter for location
  const { displayed: typedLoc } = useTypewriter(`// ${PERSON.location}`, {
    delay: 2200,
    speed: 40,
  });

  const scrollDown = () => {
    haptics.tap();
    if (snapRef.current) {
      snapRef.current.scrollTo({
        top: snapRef.current.clientHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <main className="home-page" id="main-content">
     

      <div className="home-snap" ref={snapRef}>
        {/* ── SECTION 1: HERO ───────────────────────────────── */}
        <section className="hero home-snap__section" aria-label="Introduction">
          <div className="container hero__inner">
            {/* Left, text content */}
            <div className="hero__content">
              {/* Name */}
              <h1 className="hero__name pixel-text">
                {PERSON.name.split(" ").map((word, i) => (
                  <span
                    key={i}
                    className="hero__name-word"
                    style={{ animationDelay: `${0.1 + i * 0.15}s` }}
                  >
                    {word}
                  </span>
                ))}
              </h1>

              {/* Role, typewriter.
                  Both typewriter lines reserve their final height with a
                  hidden ghost copy of the full string and paint the typed
                  text over it, so nothing below shifts as they fill in
                  (including when the string wraps to a second line). */}
              <p className="hero__role hero__type pixel-text">
                <span className="hero__type-ghost" aria-hidden="true">
                  {"> "}
                  {PERSON.tagline}
                </span>
                <span className="hero__type-live">
                  <span className="hero__role-prefix">{">"}</span>{" "}
                  <span className="hero__role-text">{typedRole}</span>
                  {!roleDone && (
                    <span className="hero__cursor" aria-hidden="true">
                      ▮
                    </span>
                  )}
                </span>
              </p>

              {/* Location, secondary typewriter */}
              <p className="hero__location hero__type vt-text">
                <span className="hero__type-ghost" aria-hidden="true">
                  {`// ${PERSON.location}`}
                </span>
                <span className="hero__type-live">{typedLoc}</span>
              </p>

              {/* Bio */}
              <p className="hero__bio">{PERSON.bio}</p>

              {/* CTA buttons */}
              <div className="hero__ctas">
                <a
                  href={asset("/resume.pdf")}
                  download="ChitranshJoshi-Resume.pdf"
                  className="btn btn--primary btn--resume pixel-text"
                  aria-label="Download resume PDF"
                  onClick={() => haptics.press()}
                >
                  ↓ RESUME
                </a>
                <Link
                  to="/about"
                  className="btn btn--primary pixel-text"
                  onClick={() => haptics.press()}
                >
                  VIEW JOURNEY
                </Link>
                <Link
                  to="/contact"
                  className="btn btn--outline pixel-text"
                  onClick={() => haptics.press()}
                >
                  HIRE ME
                </Link>
                {/* <a
                  href={PERSON.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--ghost pixel-text"
                >
                  GITHUB
                </a> */}
              </div>
            </div>

            {/* Right, profile picture (id="hero-avatar" watched by Navbar) */}
            <div className="hero__avatar-wrap" id="hero-avatar">
              <div className="hero__avatar-frame">
                <div className="hero__avatar-inner">
                  <AvatarEyes
                    src={asset("/profile.jpeg")}
                    alt={`${PERSON.name}, pixel art avatar`}
                    imgClassName="hero__avatar-img"
                    width={240}
                    height={240}
                  />
                </div>
                {/* Corner decorations */}
                <span
                  className="hero__corner hero__corner--tl pixel-text"
                  aria-hidden="true"
                >
                  ┌
                </span>
                <span
                  className="hero__corner hero__corner--tr pixel-text"
                  aria-hidden="true"
                >
                  ┐
                </span>
                <span
                  className="hero__corner hero__corner--bl pixel-text"
                  aria-hidden="true"
                >
                  └
                </span>
                <span
                  className="hero__corner hero__corner--br pixel-text"
                  aria-hidden="true"
                >
                  ┘
                </span>
              </div>

              {/* Status card below avatar */}
              <div className="hero__status pixel-text">
                <span className="hero__status-dot" aria-hidden="true" />
                AVAILABLE FOR WORK
              </div>
            </div>
          </div>

          {/* Scroll prompt */}
          <button
            className="hero__scroll-prompt"
            onClick={scrollDown}
            aria-label="Scroll to stats"
          >
            <span className="pixel-text">SCROLL</span>
            <span className="hero__scroll-arrow" aria-hidden="true">
              ▼
            </span>
          </button>
        </section>

        {/* ── SECTION 2: IMPACT + SKILLS ────────────────────── */}
        <section
          className="home-snap__section impact-skills-section"
          aria-label="Impact and skills"
        >
          <div className="container impact-skills-inner">
            <div className="impact-block">
              <h2 className="section-title pixel-text">
                <span className="section-title__prefix">// </span>
                IMPACT.log
              </h2>
              <div className="stats-grid">
                {STATS.map((s, i) => (
                  <StatCard
                    key={s.label}
                    label={s.label}
                    before={s.before}
                    after={s.after}
                    pct={s.pct}
                    unit={s.unit}
                    delay={i * 100}
                  />
                ))}
              </div>
            </div>

            <div className="impact-block">
              <h2 className="section-title pixel-text">
                <span className="section-title__prefix">// </span>
                SKILL_TREE
              </h2>
              <div className="skills-grid">
                {SKILLS.slice(0, 8).map((skill, i) => (
                  <XPBar
                    key={skill.label}
                    label={skill.label}
                    value={skill.xp}
                    delay={i * 60}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: DIRECTORY + CONTACT ─────────────────── */}
        <section
          className="home-outro home-snap__section"
          aria-labelledby="outro-heading"
        >
          <div className="container home-outro__inner" ref={ctaRef}>
            <header className="home-outro__head">
              <p className="home-outro__eyebrow pixel-text">
                <span className="home-outro__eyebrow-mark">//</span> NEXT
              </p>
              <h2 id="outro-heading" className="home-outro__title pixel-text">
                Pick a thread
              </h2>
              <p className="home-outro__lede">
                Four ways into the work: the roles behind the numbers, the
                experiments, the write-ups, and the things already shipped.
              </p>
            </header>

            {/* Directory, one full-width row per destination */}
            <nav className="home-outro__list" aria-label="Site sections">
              {NEXT_LINKS.map((item, i) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="outro-row"
                  onClick={() => haptics.tap()}
                >
                  <span className="outro-row__num pixel-text" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="outro-row__body">
                    <span className="outro-row__title pixel-text">
                      {item.title}
                    </span>
                    <span className="outro-row__desc">{item.desc}</span>
                  </span>
                  <span className="outro-row__go pixel-text" aria-hidden="true">
                    &gt;
                  </span>
                </Link>
              ))}
            </nav>

            {/* Closing action bar */}
            <div className="home-outro__bar">
              <p className="home-outro__status pixel-text">
                <span className="home-outro__status-dot" aria-hidden="true" />
                AVAILABLE FOR WORK
              </p>
              <div className="home-outro__actions">
                <a
                  href={asset("/resume.pdf")}
                  download="ChitranshJoshi-Resume.pdf"
                  className="btn btn--outline pixel-text"
                  onClick={() => haptics.press()}
                >
                  RESUME
                </a>
                <Link
                  to="/contact"
                  className={`btn btn--primary pixel-text ${ctaPressed ? "btn--pressed" : ""}`}
                  onClick={() => {
                    setCtaPressed(true);
                    haptics.press();
                  }}
                >
                  GET IN TOUCH
                  <span className="home-outro__key" aria-hidden="true">
                    ENTER
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
