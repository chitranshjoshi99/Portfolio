import { forwardRef, useEffect, useRef, useState } from "react";
import { ScrollProgressProvider } from "../../contexts/ScrollProgressContext";
import { useScrollProgress } from "../../hooks/useScrollProgress";
import { useIsMobile } from "../../hooks/useIsMobile";
import { LabsRail } from "../../components/LabsRail";
import { TVSet } from "../../components/TVSet";
import { SceneText } from "../../components/SceneText";
import { Magic8Ball } from "../../components/Magic8Ball";
import { Gacha } from "../../components/games/Gacha";
import {
  LAB_EXPERIMENTS,
  TV_EXPERIMENTS,
  TOY_EXPERIMENTS,
  type LabExperiment,
} from "../../data/labs";
import "./style.css";

// Merge an internal ref (for scroll-progress registration) with the ref the
// parent forwards (for IntersectionObserver section tracking).
function assignRef<T>(forwarded: React.ForwardedRef<T>, value: T) {
  if (typeof forwarded === "function") forwarded(value);
  else if (forwarded) forwarded.current = value;
}

// ── Hero / boot scene ─────────────────────────────────────────
function HeroScene({
  sectionRef,
}: {
  sectionRef: (el: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useScrollProgress(ref);
  return (
    <section
      className="labs-section labs-hero"
      ref={(el) => {
        ref.current = el;
        sectionRef(el);
      }}
      aria-label="Labs introduction"
    >
      <div className="labs-hero__inner">
        <p className="pixel-text labs-hero__boot">$ ls ~/labs/experiments/</p>
        <h1 className="pixel-text labs-hero__title">LABS.exe</h1>
        <p className="vt-text labs-hero__sub">
          experimental playground — digital toys &amp; works in progress.
          <br />
          each entry pairs a short write-up with a live mini-game.
        </p>
        <p className="pixel-text labs-hero__hint">
          ◀ PICK A CHANNEL · ▼ SCROLL TO EXPLORE
        </p>
      </div>
    </section>
  );
}

// ── TV blog scene (text column — LEFT side) ───────────────────
interface TVBlogSceneProps {
  experiment: LabExperiment;
  isActive: boolean;
  isMobile: boolean;
}

const TVBlogScene = forwardRef<HTMLElement, TVBlogSceneProps>(
  ({ experiment, isActive, isMobile }, forwardedRef) => {
    const ref = useRef<HTMLElement | null>(null);
    useScrollProgress(ref);
    // On mobile the shared sticky CRT is gone. TV-device experiments
    // (LinkPreview) keep a small inline CRT here so they stay "in action".
    const showInlineTV = isMobile && experiment.device === "TV";
    return (
      <article
        ref={(el) => {
          ref.current = el;
          assignRef(forwardedRef, el);
        }}
        className={`labs-section tv-blog-scene${isActive ? " tv-blog-scene--active" : ""}`}
        aria-label={experiment.title}
        aria-current={isActive ? "true" : undefined}
      >
        <div className="tv-blog-scene__inner">
          <SceneText experiment={experiment} />
          {showInlineTV && (
            <div className="tv-blog-scene__mobile-tv">
              <TVSet
                activeChannel={experiment.channel}
                tvExperiments={TV_EXPERIMENTS}
              />
            </div>
          )}
        </div>
      </article>
    );
  },
);
TVBlogScene.displayName = "TVBlogScene";

// ── Toy scene ─────────────────────────────────────────────────
interface ToySceneProps {
  experiment: LabExperiment;
  active: boolean;
}

const ToyScene = forwardRef<HTMLElement, ToySceneProps>(
  ({ experiment, active }, forwardedRef) => {
    const ref = useRef<HTMLElement | null>(null);
    useScrollProgress(ref);
    return (
      <section
        ref={(el) => {
          ref.current = el;
          assignRef(forwardedRef, el);
        }}
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
            {experiment.game === "magic8ball" ? (
              <Magic8Ball />
            ) : (
              <Gacha active={active} />
            )}
          </div>
        </div>
      </section>
    );
  },
);
ToyScene.displayName = "ToyScene";

// ── Labs page ─────────────────────────────────────────────────
export default function Labs() {
  const stageRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeChannel, setActiveChannel] = useState(1);
  const isMobile = useIsMobile();

  const TV_COUNT = TV_EXPERIMENTS.length;

  // IntersectionObserver — stage root on desktop, viewport on mobile
  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    const root = isMobile ? null : container;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(
              entry.target as HTMLElement,
            );
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
  }, [TV_COUNT, isMobile]);

  const scrollToSection = (idx: number) => {
    const container = stageRef.current;
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
      <ScrollProgressProvider stageRef={stageRef}>
        {/* Persistent named index — left rail (desktop) / top strip (mobile) */}
        <LabsRail
          activeIdx={activeIdx}
          experiments={LAB_EXPERIMENTS}
          onJump={scrollToSection}
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
                  isMobile={isMobile}
                  ref={(el) => {
                    sectionRefs.current[i + 1] = el;
                  }}
                />
              ))}
            </div>

            {/* Right: sticky CRT TV (channel-switching) — desktop only.
                On mobile each channel renders its own surface (handheld
                button for HH, inline CRT for TV) inside TVBlogScene. */}
            {!isMobile && (
              <div className="tv-zone__right">
                <div className="tv-set-wrapper">
                  <TVSet
                    activeChannel={activeChannel}
                    tvExperiments={TV_EXPERIMENTS}
                  />
                </div>
              </div>
            )}
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
