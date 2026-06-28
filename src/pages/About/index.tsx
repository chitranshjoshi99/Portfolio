import { useEffect, useRef, useState } from "react";
import { XPBar } from "../../components/XPBar";
import ExperienceCard from "../../components/ExperienceCard";
import JourneyProgress from "../../components/JourneyProgress";
import { PERSON, EXPERIENCE, EDUCATION, SKILLS } from "../../data/resume";
import "./style.css";

export default function About() {
  const [activeIdx, setActiveIdx] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([
    null,
    ...Array(EXPERIENCE.length).fill(null),
  ]);

  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    const sectionIndexMap = new WeakMap<HTMLElement, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleEntry) return;

        const index = sectionIndexMap.get(visibleEntry.target as HTMLElement);
        if (typeof index === "number") setActiveIdx(index);
      },
      { root: container, threshold: [0.35, 0.6, 0.8] },
    );

    sectionRefs.current.forEach((el, index) => {
      if (!el) return;
      sectionIndexMap.set(el, index);
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (index: number) => {
    const container = stageRef.current;
    const target = sectionRefs.current[index];
    if (!container || !target) return;

    container.scrollTo({ top: target.offsetTop, behavior: "smooth" });
  };

  const progressItems = [
    {
      id: "intro",
      company: "PROFILE",
      accentHex: "var(--accent-primary)",
      period: "ABOUT",
    },
    ...EXPERIENCE.map((exp) => ({
      id: exp.id,
      company: exp.company,
      accentHex: exp.accentHex,
      period: exp.period,
    })),
  ];

  const setSectionRef = (index: number) => (el: HTMLElement | null) => {
    sectionRefs.current[index] = el;
  };

  return (
    <main className="about-page" id="main-content">
      <div className="about-stage" ref={stageRef}>
        <section
          className="about-intro"
          aria-label="About Chitransh"
          ref={setSectionRef(0)}
        >
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
                {SKILLS.slice(0, 6).map((s, i) => (
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

        {EXPERIENCE.map((exp, i) => (
          <ExperienceCard
            key={exp.id}
            exp={exp}
            index={i}
            isActive={activeIdx === i + 1}
            ref={setSectionRef(i + 1)}
          />
        ))}

        <JourneyProgress
          items={progressItems}
          activeIdx={activeIdx}
          onDotClick={scrollToSection}
        />
      </div>
    </main>
  );
}
