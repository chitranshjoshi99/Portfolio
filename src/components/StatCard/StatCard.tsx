import { useEffect, useRef, useState } from 'react'
import './StatCard.css'

interface StatCardProps {
  label:  string
  before: string
  after:  string
  pct:    number
  unit:   string
  color?: string
  delay?: number
}

export function StatCard({ label, before, after, pct, unit, color, delay = 0 }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      className={`stat-card ${visible ? 'stat-card--visible' : ''}`}
      ref={ref}
      style={{ '--stat-color': color ?? 'var(--accent-primary)', '--delay': `${delay}ms` } as React.CSSProperties}
    >
      <span className="stat-card__label pixel-text">{label}</span>
      <div className="stat-card__values">
        <span className="stat-card__before vt-text">{before}</span>
        <span className="stat-card__arrow pixel-text">→</span>
        <span className="stat-card__after vt-text">{after}</span>
      </div>
      <div className="stat-card__bar">
        <div
          className="stat-card__fill"
          style={{ width: visible ? `${pct}%` : '0%', transitionDelay: `${delay + 200}ms` }}
        />
      </div>
      <span className="stat-card__pct pixel-text">{pct}% {unit}</span>
    </div>
  )
}
