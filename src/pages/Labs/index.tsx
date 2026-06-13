import { forwardRef, useEffect, useRef, useState } from 'react';
import { ScrollProgressProvider } from '../../contexts/ScrollProgressContext';
import { LabsRail } from '../../components/LabsRail';
import { TVSet } from '../../components/TVSet';
import { SceneText } from '../../components/SceneText';
import { Magic8Ball } from '../../components/Magic8Ball';
import { Gacha } from '../../components/games/Gacha';
import {
  LAB_EXPERIMENTS,
  TV_EXPERIMENTS,
  TOY_EXPERIMENTS,
  type LabExperiment,
} from '../../data/labs';
import './style.css';

// ── Hero / boot scene ─────────────────────────────────────────
function HeroScene({ sectionRef }: { sectionRef: (el: HTMLElement | null) => void }) {
  return (
    <section
      className="labs-section labs-hero"
      ref={sectionRef}
      aria-label="Labs introduction"
    >
      <div className="labs-hero__inner">
        <p className="pixel-text labs-hero__boot">$ ls ~/labs/experiments/</p>
        <h1 className="pixel-text labs-hero__title">LABS.exe</h1>
        <p className="vt-text labs-hero__sub">
          experimental playground — digital toys &amp; works in progress
        </p>

        <div className="labs-hero__list pixel-text">
          {LAB_EXPERIMENTS.map((exp) => (
            <div key={exp.id} className="labs-hero__entry">
              <span style={{ color: exp.accent }} aria-hidden="true">◆</span>
              <span className="labs-hero__entry-name">{exp.id.toUpperCase()}.exe</span>
              <span className="labs-hero__entry-dots" aria-hidden="true" />
              <span style={{ color: exp.accent }}>[{exp.status}]</span>
            </div>
          ))}
        </div>

        <p className="pixel-text labs-hero__hint">▼ SCROLL TO EXPLORE</p>
      </div>
    </section>
  );
}

// ── TV blog scene (text column — LEFT side) ───────────────────
interface TVBlogSceneProps {
  experiment: LabExperiment;
  isActive: boolean;
}

const TVBlogScene = forwardRef<HTMLElement, TVBlogSceneProps>(
  ({ experiment, isActive }, ref) => (
    <article
      ref={ref as React.Ref<HTMLElement>}
      className={`labs-section tv-blog-scene${isActive ? ' tv-blog-scene--active' : ''}`}
      aria-label={experiment.title}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="tv-blog-scene__inner">
        <SceneText experiment={experiment} />
      </div>
    </article>
  ),
);
TVBlogScene.displayName = 'TVBlogScene';

// ── Toy scene ─────────────────────────────────────────────────
interface ToySceneProps {
  experiment: LabExperiment;
  active: boolean;
}

const ToyScene = forwardRef<HTMLElement, ToySceneProps>(({ experiment, active }, ref) => (
  <section
    ref={ref as React.Ref<HTMLElement>}
    className="labs-section toy-scene"
    aria-label={experiment.title}
  >
    <div className="toy-scene__inner">
      {/* Text left — SceneText handles toggle + code panel */}
      <div className="toy-scene__text">
        <SceneText experiment={experiment} />
      </div>
      {/* Toy right */}
      <div className="toy-scene__game">
        {experiment.game === 'magic8ball' ? (
          <Magic8Ball />
        ) : (
          <Gacha active={active} />
        )}
      </div>
    </div>
  </section>
));
ToyScene.displayName = 'ToyScene';

// ── Labs page ─────────────────────────────────────────────────
export default function Labs() {
  const stageRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeChannel, setActiveChannel] = useState(1);

  const TV_COUNT = TV_EXPERIMENTS.length;
  const TOY_COUNT = TOY_EXPERIMENTS.length;
  const TOTAL = 1 + TV_COUNT + TOY_COUNT;

  // IntersectionObserver — stage root on desktop, viewport on mobile
  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    const isMobile = window.innerWidth <= 768;
    const root = isMobile ? null : container;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLElement);
            if (idx !== -1) {
              setActiveIdx(idx);
              if (idx >= 1 && idx <= TV_COUNT) {
                setActiveChannel(idx);
              }
            }
          }
        }
      },
      { root, threshold: 0.5 },
    );

    sectionRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToSection = (idx: number) => {
    const container = stageRef.current;
    const target = sectionRefs.current[idx];
    if (!container || !target) return;
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (tRect.top - cRect.top),
      behavior: 'smooth',
    });
  };

  return (
    <main className="labs-page" id="main-content">
      <ScrollProgressProvider stageRef={stageRef}>
        {/* Floating pill rail — fixed position, not in flow */}
        <LabsRail
          activeIdx={activeIdx}
          totalSections={TOTAL}
          experiments={LAB_EXPERIMENTS}
          onJump={scrollToSection}
          isVisible={activeIdx > 0}
        />

        <div className="labs-stage" ref={stageRef}>
          {/* Section 0: Hero */}
          <HeroScene
            sectionRef={(el) => {
              sectionRefs.current[0] = el;
            }}
          />

          {/* TV Zone: LEFT = text (scrollable), RIGHT = sticky CRT TV */}
          <div className="tv-zone">
            {/* Left: scrollable text column */}
            <div className="tv-zone__left">
              {TV_EXPERIMENTS.map((exp, i) => (
                <TVBlogScene
                  key={exp.id}
                  experiment={exp}
                  isActive={activeChannel === exp.channel}
                  ref={(el) => {
                    sectionRefs.current[i + 1] = el;
                  }}
                />
              ))}
            </div>

            {/* Right: sticky CRT TV (channel-switching) */}
            <div className="tv-zone__right">
              <div className="tv-set-wrapper">
                <TVSet activeChannel={activeChannel} tvExperiments={TV_EXPERIMENTS} />
              </div>
            </div>
          </div>

          {/* Toy Scenes */}
          {TOY_EXPERIMENTS.map((exp, i) => {
            const idx = TV_COUNT + 1 + i;
            return (
              <ToyScene
                key={exp.id}
                experiment={exp}
                active={activeIdx === idx}
                ref={(el) => {
                  sectionRefs.current[idx] = el;
                }}
              />
            );
          })}
        </div>
      </ScrollProgressProvider>
    </main>
  );
}
