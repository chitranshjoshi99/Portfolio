// ============================================================
// RESUME DATA — single source of truth for the portfolio
// ============================================================

export const PERSON = {
  name:     'Chitransh Joshi',
  initials: 'CJ',
  role:     'Software Development Engineer',
  tagline:  'Frontend-first Full-Stack Engineer',
  bio:      'Building high-performance web apps for 5+ years across logistics, B2B marketplaces, and edtech. I turn slow, fragile systems into fast, reliable products — and ship end-to-end features that actually move metrics.',
  location: 'Gurugram, India',
  email:    'chitransh.joshi99@gmail.com',
  phone:    '+91 81261 96827',
  github:   'https://github.com/chitranshjoshi99',
} as const

// ── Key stats (shown as RPG stat bars on Home) ──────────────
export const STATS = [
  { label: 'Page Load',   before: '4.2s',  after: '1.1s',  pct: 74, unit: 'faster' },
  { label: 'CI Build',    before: '18min', after: '6min',  pct: 67, unit: 'faster' },
  { label: 'P95 API',     before: '800ms', after: '120ms', pct: 85, unit: 'faster' },
  { label: 'Bundle Size', before: '100%',  after: '58%',   pct: 42, unit: 'smaller' },
] as const

// ── Tech skills (for skill grid / XP bars) ──────────────────
export const SKILLS = [
  // Core
  { label: 'React',       xp: 95, category: 'frontend' },
  { label: 'TypeScript',  xp: 90, category: 'frontend' },
  { label: 'GraphQL',     xp: 85, category: 'data' },
  { label: 'Next.js',     xp: 80, category: 'frontend' },
  { label: 'Redux',       xp: 85, category: 'frontend' },
  { label: 'Node.js',     xp: 70, category: 'backend' },
  // Tooling
  { label: 'Vite / Nx',  xp: 88, category: 'tooling' },
  { label: 'PostgreSQL',  xp: 72, category: 'backend' },
  { label: 'Tailwind',    xp: 88, category: 'frontend' },
  { label: 'Cypress',     xp: 70, category: 'testing' },
  // AI
  { label: 'Claude API',  xp: 80, category: 'ai' },
  { label: 'Datadog',     xp: 75, category: 'infra' },
] as const

export type Skill = typeof SKILLS[number]

// ── Work experience ──────────────────────────────────────────

export interface Achievement {
  label: string
  metric?: string   // bold highlight e.g. "40%"
  text:   string
}

export interface Experience {
  id:          string
  company:     string
  companyFull: string
  role:        string
  period:      string
  location:    string
  // Design language
  accentVar:   string    // CSS variable name e.g. '--nivoda-gold'
  accentHex:   string    // fallback hex
  bgHex:       string    // dark background hex for card
  // Content
  summary:     string
  achievements: Achievement[]
  tags:        string[]
}

export const EXPERIENCE: Experience[] = [
  {
    id:          'nivoda',
    company:     'Nivoda',
    companyFull: 'Nivoda LLP',
    role:        'Software Development Engineer II',
    period:      'May 2024 – Apr 2026',
    location:    'Mumbai · Remote',
    accentVar:   '--nivoda-gold',
    accentHex:   '#9E8562',
    bgHex:       '#1C1812',
    summary:     'Built and scaled a B2B diamond trading platform — shipping a barcode-driven shipment system, optimising GraphQL APIs for 50k+ row datasets, and pioneering AI tooling across the engineering org.',
    achievements: [
      { label: 'Order Page Load',   metric: '4.2s → 1.1s',  text: 'Pagination & query optimisation on 10k+ monthly transactions' },
      { label: 'GraphQL Queries',   metric: '–70%',          text: 'Cursor-based pagination eliminating timeouts on 50k-row datasets' },
      { label: 'P95 API Latency',   metric: '800ms → 120ms', text: 'Composite indexes on 5M+ row order/shipment tables' },
      { label: 'Processing Errors', metric: '–40%',          text: 'Barcode-scan shipment platform for international diamond logistics' },
      { label: 'Render Perf',       metric: '+45%',          text: 'Virtualised lists & memoisation on delivery hub dashboards' },
      { label: 'TypeScript Bugs',   metric: '–25%',          text: 'Led monorepo-wide TypeScript migration with typed API adoption' },
      { label: 'AI Tooling',        metric: 'Day-1 adopter', text: 'Built custom Claude Code skills to automate code reviews team-wide' },
    ],
    tags: ['React', 'TypeScript', 'GraphQL', 'Nx', 'ArgoCD', 'PostgreSQL', 'Datadog', 'Claude API'],
  },
  {
    id:          'delhivery',
    company:     'Delhivery',
    companyFull: 'Delhivery Pvt. Ltd.',
    role:        'Software Development Engineer I',
    period:      'Aug 2022 – Apr 2024',
    location:    'Gurugram',
    accentVar:   '--delhivery-red',
    accentHex:   '#B87A72',
    bgHex:       '#1C1212',
    summary:     'Modularised a monolithic logistics platform into independent apps, built real-time WebSocket shipment tracking for 10k+ daily shipments, and integrated multi-provider maps to cut costs by 35%.',
    achievements: [
      { label: 'Deployment Speed', metric: '–40%',     text: 'Decoupled services for independent versioning & rollbacks' },
      { label: 'JS Bundle',        metric: '–42%',     text: 'Code-splitting, lazy loading & memoisation on logistics dashboards' },
      { label: 'Maps Cost',        metric: '–35%',     text: 'Tier-based Google / OSM / MapMyIndia / HereMaps dynamic switching' },
      { label: 'Test Coverage',    metric: '70%+',     text: 'Jest + RTL suites across 5 modular apps, –30% regression defects' },
      { label: 'Exception Response', metric: '–50%',  text: 'WebSocket live tracking for 10k+ active daily shipments' },
      { label: 'A11y Score',       metric: '62 → 94',  text: 'WCAG 2.1 AA audit — keyboard nav, ARIA, colour contrast fixes' },
    ],
    tags: ['React', 'MUI', 'WebSockets', 'Redux', 'Node.js', 'Jest', 'Maps APIs', 'TypeScript'],
  },
  {
    id:          'classplus',
    company:     'Classplus',
    companyFull: 'Classplus (Bunch Microtechnologies)',
    role:        'Software Engineer, Frontend',
    period:      'Dec 2020 – Aug 2022',
    location:    'Noida',
    accentVar:   '--classplus-purple',
    accentHex:   '#8B7BA8',
    bgHex:       '#14121C',
    summary:     'Built the Classplus Content Store from scratch — Redux-Saga payment flows, HLS.js adaptive video player, 100ms WebRTC live classes with 200–500 concurrent viewers, and Next.js mobile web-view.',
    achievements: [
      { label: 'Video Quality Drops', metric: '–40%',   text: 'Custom HLS.js ABR player with dynamic rendition switching' },
      { label: 'Video Abandonment',   metric: '–28%',   text: 'Tiered MEDIA/NETWORK error recovery with exponential backoff' },
      { label: 'Live Classes',        metric: '200–500', text: 'Concurrent viewers via 100ms WebRTC SDK with reconnection logic' },
      { label: 'Vendor Onboarding',   metric: '–35%',   text: 'Server-driven UI campaigns configurable from a non-tech dashboard' },
      { label: 'Micro Frontend',      metric: '✓',       text: 'Decoupled Content Store into independent micro frontend' },
    ],
    tags: ['React', 'Next.js', 'Redux-Saga', 'HLS.js', '100ms SDK', 'WebRTC', 'TypeScript'],
  },
]

// ── Education ────────────────────────────────────────────────
export const EDUCATION = {
  degree:   'Bachelor of Technology — Computer Science & Engineering',
  school:   'APJ Abdul Kalam Technical University, UP',
  period:   '2016 – 2020',
} as const
