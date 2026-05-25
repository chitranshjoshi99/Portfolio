import { useEffect, useRef, useState, forwardRef } from 'react'
import { XPBar } from '../components/XPBar/XPBar'
import { PERSON, EXPERIENCE, EDUCATION, SKILLS } from '../data/resume'
import type { Experience } from '../data/resume'
import './About.css'

export default function About() {
  const [activeIdx, setActiveIdx] = useState(0)
  // cardRefs holds the DOM nodes of each exp-card section
  const cardRefs = useRef<(HTMLElement | null)[]>([null, null, null])
  const journeyRef = useRef<HTMLDivElement>(null)

  // ── IntersectionObserver: root = the scroll container ──────
  // Must run after mount so both journeyRef and cardRefs are populated.
  useEffect(() => {
    const container = journeyRef.current
    if (!container) return

    const observers: IntersectionObserver[] = []

    cardRefs.current.forEach((el, i) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveIdx(i)
        },
        {
          root: container,   // observe within the scroll box, not the viewport
          threshold: 0.5,
        }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach(o => o.disconnect())
  }, [])

  // ── Scroll a card into view inside journey-scroll ──────────
  // Cannot use scrollIntoView when the scrollable ancestor isn't the viewport.
  const scrollToCard = (i: number) => {
    const container = journeyRef.current
    const card = cardRefs.current[i]
    if (!container || !card) return

    // getBoundingClientRect gives positions relative to the viewport;
    // subtracting container top + adding current scrollTop gives correct offset.
    const cardTop = card.getBoundingClientRect().top
                  - container.getBoundingClientRect().top
                  + container.scrollTop

    container.scrollTo({ top: cardTop, behavior: 'smooth' })
  }

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
              <span className="edu-card__icon" aria-hidden="true">🎓</span>
              <div>
                <p className="edu-card__degree pixel-text">{EDUCATION.degree}</p>
                <p className="edu-card__school">{EDUCATION.school} · {EDUCATION.period}</p>
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
                    s.category === 'frontend' ? 'var(--accent-primary)' :
                    s.category === 'data'     ? 'var(--nivoda-gold)' :
                    s.category === 'backend'  ? 'var(--delhivery-red)' :
                                                'var(--classplus-purple)'
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
              <span className="journey-header__prefix">// </span>EXPERIENCE.map()
            </h2>
            <p className="journey-header__sub">Three companies. Five years. Scroll through.</p>
          </div>

          <nav className="journey-tabs" aria-label="Jump to experience">
            {EXPERIENCE.map((exp, i) => (
              <button
                key={exp.id}
                className={`journey-tab ${activeIdx === i ? 'journey-tab--active' : ''}`}
                style={{ '--tab-color': exp.accentHex } as React.CSSProperties}
                onClick={() => scrollToCard(i)}
                aria-label={`Go to ${exp.company}`}
                aria-current={activeIdx === i ? 'true' : undefined}
              >
                <span className="journey-tab__num pixel-text">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="journey-tab__name pixel-text">{exp.company}</span>
                <span className="journey-tab__period">{exp.period.split('–')[0].trim()}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Scroll-snap experience cards ──────────────────── */}
      <div className="journey-scroll-wrap">
        <div className="journey-scroll" ref={journeyRef}>
          {EXPERIENCE.map((exp, i) => (
            <ExperienceCard
              key={exp.id}
              exp={exp}
              index={i}
              isActive={activeIdx === i}
              ref={(el: HTMLElement | null) => { cardRefs.current[i] = el }}
            />
          ))}
        </div>

        {/* ── Right-side progress indicator ─────────────── */}
        <JourneyProgress
          experiences={EXPERIENCE}
          activeIdx={activeIdx}
          onDotClick={scrollToCard}
        />
      </div>

    </main>
  )
}

// ── Right-side carousel progress dots ───────────────────────

interface JourneyProgressProps {
  experiences: typeof EXPERIENCE
  activeIdx:   number
  onDotClick:  (i: number) => void
}

function JourneyProgress({ experiences, activeIdx, onDotClick }: JourneyProgressProps) {
  return (
    <div className="journey-progress" aria-label="Experience progress">
      {/* Vertical track line */}
      <div className="journey-progress__track">
        <div
          className="journey-progress__fill"
          style={{ height: `${((activeIdx + 1) / experiences.length) * 100}%` }}
        />
      </div>

      {/* Dots */}
      {experiences.map((exp, i) => (
        <button
          key={exp.id}
          className={`jp-dot ${activeIdx === i ? 'jp-dot--active' : ''} ${activeIdx > i ? 'jp-dot--past' : ''}`}
          style={{ '--dot-color': exp.accentHex } as React.CSSProperties}
          onClick={() => onDotClick(i)}
          aria-label={exp.company}
          title={exp.company}
        >
          {/* Outer ring */}
          <span className="jp-dot__ring" />
          {/* Inner fill */}
          <span className="jp-dot__fill" />
          {/* Label tooltip */}
          <span className="jp-dot__tooltip pixel-text">
            <span className="jp-dot__tooltip-name">{exp.company}</span>
            <span className="jp-dot__tooltip-period">{exp.period}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Experience Card ──────────────────────────────────────────
// Must use forwardRef so the parent can store the DOM node in cardRefs.
// (Passing `ref` as a plain prop silently drops it in React 18.)

interface ExpCardProps {
  exp:      Experience
  index:    number
  isActive: boolean
}

const ExperienceCard = forwardRef<HTMLElement, ExpCardProps>(
  function ExperienceCard({ exp, index, isActive }, ref) {
    const isEven = index % 2 === 0

    return (
      <section
        className={`exp-card exp-card--${exp.id} ${isActive ? 'exp-card--active' : ''}`}
        // forwardRef gives us the DOM node; cast because <section> returns HTMLElement
        ref={ref as React.Ref<HTMLElement>}
        style={{
          '--exp-accent':     exp.accentHex,
          '--exp-accent-dim': exp.accentHex + '22',
          '--exp-bg':         exp.bgHex,
        } as React.CSSProperties}
        aria-label={`${exp.companyFull} experience`}
      >
        {/* Subtle tinted background overlay — activates on active card */}
        <div className="exp-card__bg-overlay" aria-hidden="true" />

        <div className={`container exp-card__inner ${isEven ? '' : 'exp-card__inner--reverse'}`}>

          {/* ── Left: company info ───────────────────────── */}
          <div className="exp-panel exp-panel--left">
            <div className="exp-company">
              <p className="exp-company__index pixel-text">
                {String(index + 1).padStart(2, '0')} / {String(EXPERIENCE.length).padStart(2, '0')}
              </p>
              <h2 className="exp-company__name pixel-text">{exp.company}</h2>
              <p className="exp-company__full">{exp.companyFull}</p>
              <p className="exp-company__role pixel-text">{exp.role}</p>

              <div className="exp-meta">
                <span className="exp-meta__chip pixel-text">📅 {exp.period}</span>
                <span className="exp-meta__chip pixel-text">📍 {exp.location}</span>
              </div>

              <p className="exp-summary">{exp.summary}</p>
            </div>

            <div className="exp-tags">
              {exp.tags.map(tag => (
                <span key={tag} className="exp-tag pixel-text">{tag}</span>
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
                  className={`exp-achievement ${isActive ? 'exp-achievement--visible' : ''}`}
                  style={{ transitionDelay: `${100 + j * 70}ms` }}
                >
                  <span className="exp-achievement__icon pixel-text" aria-hidden="true">▶</span>
                  <div className="exp-achievement__body">
                    <div className="exp-achievement__top">
                      <span className="exp-achievement__label pixel-text">{a.label}</span>
                      {a.metric && (
                        <span className="exp-achievement__metric vt-text">{a.metric}</span>
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
        <div className="exp-card__corner exp-card__corner--tl" aria-hidden="true" />
        <div className="exp-card__corner exp-card__corner--br" aria-hidden="true" />
      </section>
    )
  }
)
