import { useEffect, useRef, useState } from 'react'
import './XPBar.css'

interface XPBarProps {
  label:   string
  value:   number   // 0–100
  color?:  string   // CSS color or var(--...)
  delay?:  number   // animation stagger in ms
}

export function XPBar({ label, value, color, delay = 0 }: XPBarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setFilled(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const segments = 20
  const filledCount = filled ? Math.round((value / 100) * segments) : 0

  return (
    <div className="xp-bar" ref={ref}>
      <div className="xp-bar__header">
        <span className="xp-bar__label pixel-text">{label}</span>
        <span className="xp-bar__value pixel-text">{value}</span>
      </div>
      <div className="xp-bar__track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={`xp-bar__segment ${i < filledCount ? 'xp-bar__segment--filled' : ''}`}
            style={{
              '--seg-color': color ?? 'var(--accent-primary)',
              transitionDelay: filled ? `${delay + i * 30}ms` : '0ms',
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}
