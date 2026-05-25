import { useRef, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTypewriter } from '../../hooks/useTypewriter'
import { StatCard } from '../../components/StatCard'
import { XPBar } from '../../components/XPBar'
import { PERSON, STATS, SKILLS } from '../../data/resume'
import './style.css'

// ── Pixel decorations ────────────────────────────────────────
const PIXEL_DECO = ['◆', '▲', '●', '■', '◇', '△', '○', '□']

function randomDeco(seed: number) {
  return PIXEL_DECO[seed % PIXEL_DECO.length]
}

// ── Skill category colours ───────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  frontend: 'var(--accent-primary)',
  backend:  'var(--delhivery-red)',
  data:     'var(--nivoda-gold)',
  tooling:  'var(--accent-secondary)',
  testing:  'var(--delhivery-red-dim)',
  ai:       'var(--classplus-purple)',
  infra:    'var(--classplus-purple-dim)',
}

export default function Home() {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const ctaRef     = useRef<HTMLDivElement>(null)
  const ctaBtnRef  = useRef<HTMLAnchorElement>(null)
  const [ctaInView, setCtaInView]   = useState(false)
  const [ctaPressed, setCtaPressed] = useState(false)
  const navigate = useNavigate()

  // Track when the "PRESS START" screen enters the viewport
  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setCtaInView(entry.isIntersecting),
      { threshold: 0.6 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ENTER key fires the button when CTA is in view
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !ctaInView || ctaPressed) return
      e.preventDefault()
      setCtaPressed(true)
      // Brief visual "press" before navigating
      setTimeout(() => navigate('/about'), 320)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [ctaInView, ctaPressed, navigate])

  // Typewriter for the hero role line
  const { displayed: typedRole, done: roleDone } =
    useTypewriter(PERSON.tagline, { delay: 800, speed: 50 })

  // Secondary typewriter for location
  const { displayed: typedLoc } =
    useTypewriter(`// ${PERSON.location}`, { delay: 2200, speed: 40 })

  const scrollDown = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main className="home-page">
      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="hero" aria-label="Introduction">
        {/* Floating pixel decorations */}
        <div className="hero__deco" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="hero__deco-dot"
              style={{
                '--deco-x':     `${8 + (i * 7.7) % 88}%`,
                '--deco-y':     `${5 + (i * 11.3) % 85}%`,
                '--deco-delay': `${(i * 0.4) % 3}s`,
                '--deco-dur':   `${2.5 + (i * 0.3) % 2}s`,
              } as React.CSSProperties}
            >
              {randomDeco(i)}
            </span>
          ))}
        </div>

        <div className="container hero__inner">
          {/* Left — text content */}
          <div className="hero__content">
            {/* Boot sequence label */}
            <p className="hero__boot pixel-text">
              <span className="hero__boot-prefix">$</span> ./boot-portfolio.sh
            </p>

            {/* Name */}
            <h1 className="hero__name pixel-text">
              {PERSON.name.split(' ').map((word, i) => (
                <span key={i} className="hero__name-word" style={{ animationDelay: `${0.1 + i * 0.15}s` }}>
                  {word}
                </span>
              ))}
            </h1>

            {/* Role — typewriter */}
            <p className="hero__role pixel-text">
              <span className="hero__role-prefix">{'>'}</span>{' '}
              <span className="hero__role-text">{typedRole}</span>
              {!roleDone && <span className="hero__cursor" aria-hidden="true">▮</span>}
            </p>

            {/* Location — secondary typewriter */}
            <p className="hero__location vt-text">{typedLoc}</p>

            {/* Bio */}
            <p className="hero__bio">{PERSON.bio}</p>

            {/* Years badge */}
            <div className="hero__badges">
              <span className="hero__badge pixel-text">LVL 5+ EXP</span>
              <span className="hero__badge hero__badge--gold pixel-text">REACT MASTER</span>
              <span className="hero__badge hero__badge--purple pixel-text">AI ADOPTER</span>
            </div>

            {/* CTA buttons */}
            <div className="hero__ctas">
              <Link to="/about" className="btn btn--primary pixel-text">
                VIEW JOURNEY
              </Link>
              <Link to="/contact" className="btn btn--outline pixel-text">
                HIRE ME
              </Link>
              <a
                href="/resume.pdf"
                download="ChitranshJoshi-Resume.pdf"
                className="btn btn--resume pixel-text"
                aria-label="Download resume PDF"
              >
                ↓ RESUME
              </a>
              <a
                href={PERSON.github}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--ghost pixel-text"
              >
                GITHUB
              </a>
            </div>
          </div>

          {/* Right — profile picture */}
          <div className="hero__avatar-wrap">
            <div className="hero__avatar-frame">
              <div className="hero__avatar-inner">
                <img
                  src="/profile.jpeg"
                  alt={`${PERSON.name} — pixel art avatar`}
                  className="hero__avatar-img"
                  width="240"
                  height="240"
                />
              </div>
              {/* Corner decorations */}
              <span className="hero__corner hero__corner--tl pixel-text" aria-hidden="true">┌</span>
              <span className="hero__corner hero__corner--tr pixel-text" aria-hidden="true">┐</span>
              <span className="hero__corner hero__corner--bl pixel-text" aria-hidden="true">└</span>
              <span className="hero__corner hero__corner--br pixel-text" aria-hidden="true">┘</span>
            </div>

            {/* Status card below avatar */}
            <div className="hero__status pixel-text">
              <span className="hero__status-dot" aria-hidden="true" />
              AVAILABLE FOR WORK
            </div>
          </div>
        </div>

        {/* Scroll prompt */}
        <button className="hero__scroll-prompt" onClick={scrollDown} aria-label="Scroll to stats">
          <span className="pixel-text">SCROLL</span>
          <span className="hero__scroll-arrow" aria-hidden="true">▼</span>
        </button>
      </section>

      {/* ── STATS ─────────────────────────────────────────── */}
      <section className="stats-section" ref={scrollRef} aria-label="Performance metrics">
        <div className="container">
          <h2 className="section-title pixel-text">
            <span className="section-title__prefix">// </span>
            IMPACT.log
          </h2>
          <p className="section-subtitle">Real metrics from real production systems.</p>

          <div className="stats-grid">
            {STATS.map((s, i) => (
              <StatCard
                key={s.label}
                label={s.label}
                before={s.before}
                after={s.after}
                pct={s.pct}
                unit={s.unit}
                color={
                  i === 0 ? 'var(--nivoda-gold)' :
                  i === 1 ? 'var(--delhivery-red)' :
                  i === 2 ? 'var(--classplus-purple)' :
                            'var(--accent-primary)'
                }
                delay={i * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── SKILLS ────────────────────────────────────────── */}
      <section className="skills-section" aria-label="Technical skills">
        <div className="container">
          <h2 className="section-title pixel-text">
            <span className="section-title__prefix">// </span>
            SKILL_TREE
          </h2>
          <p className="section-subtitle">5+ years of grinding XP across the stack.</p>

          <div className="skills-grid">
            {SKILLS.map((skill, i) => (
              <XPBar
                key={skill.label}
                label={skill.label}
                value={skill.xp}
                color={CAT_COLOR[skill.category] ?? 'var(--accent-primary)'}
                delay={i * 60}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION ────────────────────────────────── */}
      <section className="home-cta-section" aria-label="Call to action">
        <div className="container home-cta-inner">
          {/* Pixel screen — ENTER key activates when this is visible */}
          <div
            ref={ctaRef}
            className={`pixel-screen ${ctaPressed ? 'pixel-screen--pressed' : ''}`}
            role="group"
            aria-label="Press ENTER to view experience"
          >
            <span className="pixel-text pixel-screen__text">PRESS START</span>
            <span className="pixel-screen__sub vt-text">to view my experience →</span>
            <span className="pixel-screen__hint pixel-text">[ ENTER ]</span>
          </div>

          <Link
            to="/about"
            ref={ctaBtnRef}
            className={`btn btn--primary btn--lg pixel-text ${ctaPressed ? 'btn--pressed' : ''}`}
            onClick={() => setCtaPressed(true)}
          >
            ▶ VIEW EXPERIENCE
          </Link>
        </div>
      </section>
    </main>
  )
}
