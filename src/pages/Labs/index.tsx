import { useState, useEffect, useRef } from "react";
import { Magic8Ball } from "../../components/Magic8Ball";
import "./style.css";

// ── Section metadata ──────────────────────────────────────────
const LABS_SECTIONS = [
  { id: "intro", label: "INIT" },
  { id: "oracle", label: "ORACLE" },
  { id: "arcade", label: "ARCADE" },
  { id: "blog", label: "BLOG" },
] as const;

// ── Retro TV static-noise canvas ─────────────────────────────
function RetroTVScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    function drawNoise() {
      const img = ctx!.createImageData(W, H);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = Math.random();
        const v =
          r < 0.55
            ? Math.floor(Math.random() * 30) // dark
            : r < 0.78
              ? 60 + Math.floor(Math.random() * 80) // mid
              : 150 + Math.floor(Math.random() * 105); // bright
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx!.putImageData(img, 0, 0);
      rafRef.current = requestAnimationFrame(drawNoise);
    }

    drawNoise();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="retro-tv__canvas"
      width={60}
      height={45}
      aria-hidden="true"
    />
  );
}

// ── Blog terminal with animated lines ────────────────────────
const TERMINAL_LINES: { prompt: string; text: string; color?: string }[] = [
  { prompt: "$", text: "cd ~/blog/posts" },
  { prompt: "", text: "reading directory...", color: "var(--text-muted)" },
  { prompt: "", text: "error: 0 posts found", color: "var(--delhivery-red)" },
  { prompt: "$", text: "git log --oneline" },
  { prompt: "", text: "fatal: no commits yet", color: "var(--delhivery-red)" },
  { prompt: "$", text: "echo 'writing soon...'" },
  { prompt: ">", text: "writing soon...", color: "var(--nivoda-gold)" },
  {
    prompt: "$",
    text: "watch -n1 new-post.md",
    color: "var(--accent-primary)",
  },
];

function BlogTerminal({ isActive }: { isActive: boolean }) {
  const [count, setCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isActive) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setCount(0);

    TERMINAL_LINES.forEach((_, i) => {
      const t = setTimeout(() => setCount(i + 1), i * 650);
      timersRef.current.push(t);
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, [isActive]);

  return (
    <div className="blog-terminal">
      {/* Title bar */}
      <div className="blog-terminal__titlebar">
        <div className="blog-terminal__dots" aria-hidden="true">
          <span className="blog-terminal__dot blog-terminal__dot--red" />
          <span className="blog-terminal__dot blog-terminal__dot--yellow" />
          <span className="blog-terminal__dot blog-terminal__dot--green" />
        </div>
        <span className="pixel-text blog-terminal__title">blog_v0.sh</span>
        <span className="pixel-text blog-terminal__status">WRITING...</span>
      </div>

      {/* Body */}
      <div className="blog-terminal__body" role="log" aria-live="polite">
        {TERMINAL_LINES.slice(0, count).map((line, i) => (
          <p
            key={i}
            className="blog-terminal__line vt-text"
            style={line.color ? { color: line.color } : undefined}
          >
            {line.prompt && (
              <span className="blog-terminal__prompt">{line.prompt} </span>
            )}
            {line.text}
          </p>
        ))}
        {count < TERMINAL_LINES.length && (
          <span className="blog-terminal__cursor pixel-text" aria-hidden="true">
            ▮
          </span>
        )}
      </div>
    </div>
  );
}

// ── Labs page ─────────────────────────────────────────────────
export default function Labs() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Track the active section via IntersectionObserver on the scroll container
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(
              entry.target as HTMLElement,
            );
            if (idx !== -1) setActiveIdx(idx);
          }
        }
      },
      { root: container, threshold: 0.5 },
    );

    sectionRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollToSection = (idx: number) => {
    const container = scrollRef.current;
    const target = sectionRefs.current[idx];
    if (!container || !target) return;
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (tRect.top - cRect.top),
      behavior: "smooth",
    });
  };

  return (
    <main className="labs-page" id="main-content">
      {/* ── Side progress dots ──────────────────────────────── */}
      <nav className="labs-progress" aria-label="Lab sections">
        {LABS_SECTIONS.map(({ label }, idx) => (
          <button
            key={label}
            className={`labs-progress__dot${activeIdx === idx ? " labs-progress__dot--active" : ""}`}
            onClick={() => scrollToSection(idx)}
            aria-label={`Go to ${label}`}
            title={label}
          />
        ))}
      </nav>

      {/* ── Scroll container ─────────────────────────────────── */}
      <div className="labs-scroll" ref={scrollRef}>
        {/* ════════════ SECTION 0 — INTRO ════════════════════ */}
        <section
          className="labs-section labs-section--intro"
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          aria-label="Labs introduction"
        >
          <div className="container labs-intro">
            <div className="labs-intro__header">
              <p className="pixel-text labs-intro__boot">
                $ ls ~/labs/experiments/
              </p>
              <h1 className="pixel-text labs-intro__title">LABS.exe</h1>
              <p className="vt-text labs-intro__sub">
                experimental playground — digital toys &amp; works in progress
              </p>
            </div>

            <div className="labs-intro__list">
              {[
                {
                  name: "ORACLE_v1.exe",
                  status: "RUNNING",
                  color: "var(--classplus-purple)",
                },
                {
                  name: "ARCADE.exe",
                  status: "OFFLINE",
                  color: "var(--delhivery-red)",
                },
                {
                  name: "BLOG.exe",
                  status: "WRITING",
                  color: "var(--nivoda-gold)",
                },
              ].map(({ name, status, color }) => (
                <div key={name} className="labs-intro__item pixel-text">
                  <span style={{ color }} aria-hidden="true">
                    ◆
                  </span>
                  <span className="labs-intro__item-name">{name}</span>
                  <span className="labs-intro__item-dots" aria-hidden="true" />
                  <span style={{ color }}>[{status}]</span>
                </div>
              ))}
            </div>

            <p className="pixel-text labs-intro__hint">▼ SCROLL TO EXPLORE</p>
          </div>
        </section>

        {/* ════════════ SECTION 1 — ORACLE ═══════════════════ */}
        <section
          className="labs-section labs-section--oracle"
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
          aria-label="Oracle experiment"
        >
          <div className="labs-card">
            <div className="labs-card__header">
              <span className="pixel-text labs-card__title">ORACLE_v1.exe</span>
              <span className="pixel-text labs-card__badge labs-card__badge--running">
                ● RUNNING
              </span>
            </div>
            <div className="labs-card__body">
              <Magic8Ball />
              <p className="vt-text labs-card__desc">
                Ask it anything. like,
                <br />
                Should you hire me?
              </p>
            </div>
          </div>
        </section>

        {/* ════════════ SECTION 2 — ARCADE ═══════════════════ */}
        <section
          className="labs-section labs-section--arcade"
          ref={(el) => {
            sectionRefs.current[2] = el;
          }}
          aria-label="Arcade games placeholder"
        >
          <div className="labs-card">
            <div className="labs-card__header">
              <span className="pixel-text labs-card__title">ARCADE.exe</span>
              <span className="pixel-text labs-card__badge labs-card__badge--offline">
                ◌ OFFLINE
              </span>
            </div>
            <div className="labs-card__body">
              {/* Retro TV */}
              <div
                className="retro-tv"
                role="img"
                aria-label="Retro TV showing no signal"
              >
                {/* Antennas */}
                <div className="retro-tv__antennas" aria-hidden="true">
                  <div className="retro-tv__antenna retro-tv__antenna--left" />
                  <div className="retro-tv__antenna retro-tv__antenna--right" />
                </div>

                {/* Body */}
                <div className="retro-tv__body">
                  {/* Screen */}
                  <div className="retro-tv__screen-wrap">
                    <RetroTVScreen />
                    <div className="retro-tv__overlay" aria-hidden="true">
                      <span className="pixel-text">NO</span>
                      <span className="pixel-text">SIGNAL</span>
                    </div>
                    <div className="retro-tv__scanlines" aria-hidden="true" />
                  </div>

                  {/* Control panel */}
                  <div className="retro-tv__controls" aria-hidden="true">
                    <div className="retro-tv__knob">
                      <div className="retro-tv__knob-face" />
                      <span className="pixel-text retro-tv__knob-label">
                        CH
                      </span>
                    </div>
                    <div className="retro-tv__speaker">
                      {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="retro-tv__speaker-dot" />
                      ))}
                    </div>
                    <div className="retro-tv__knob">
                      <div className="retro-tv__knob-face" />
                      <span className="pixel-text retro-tv__knob-label">
                        VOL
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="vt-text labs-card__desc">
                Mini-games loading. Expected broadcast:
                <br />
                when I have the time.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════ SECTION 3 — BLOG ══════════════════════ */}
        <section
          className="labs-section labs-section--blog"
          ref={(el) => {
            sectionRefs.current[3] = el;
          }}
          aria-label="Blog placeholder"
        >
          <div className="labs-card">
            <div className="labs-card__header">
              <span className="pixel-text labs-card__title">BLOG.exe</span>
              <span className="pixel-text labs-card__badge labs-card__badge--writing">
                ◎ WRITING
              </span>
            </div>
            <div className="labs-card__body">
              <BlogTerminal isActive={activeIdx === 3} />
              <p className="vt-text labs-card__desc">
                Engineering notes &amp; half-baked thoughts.
                <br />
                Coming when inspiration strikes.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
