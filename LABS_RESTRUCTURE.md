# Labs Restructure — Implementation Spec

> Handoff spec for Claude Code. Build the new Labs experience described below.
> Follow all existing conventions in `CLAUDE.md` (one folder per component with
> `index.tsx` + `style.css`, CSS variables in `tokens.css`, utilities in
> `global.css`, content in `src/data/`, no Tailwind, pixel-art rules). Update
> `CLAUDE.md` in the same commit — the pre-commit hook enforces it.

---

## 1. Goal

Turn Labs from four static placeholder sections into a content-driven,
**blog-centric, experience-driven** scroll journey. Each scene = one blog
(brief text + always-interactive mini-game + an expandable code panel showing
the core logic). A shared CRT TV hosts all "screen" games as switchable
**channels**; standalone "toy" games scroll in/out on their own.

## 2. Locked decisions

| Decision | Choice |
| --- | --- |
| Scroll mechanic | **Hybrid** — scroll-snap rest points (desktop) **+** the TV zone is pinned (`position: sticky`) so channels change while the set stays put. |
| Index rail | **Left rail** on desktop (≥900px). On mobile, collapses to a **slim sticky horizontal channel-strip** under the navbar — always visible, never a hidden drawer. |
| Blog depth (v1) | Game is **always rendered and interactive**. Brief teaser text per scene + an **expand toggle** that reveals the core logic as a styled code panel **beside/below the game without unmounting or covering it**. |
| Ordering | Scroll **grouped by render type** (all TV channels contiguous, then toys). Nav order = scroll order, with a thin `TV CHANNELS` / `TOYS` divider label in the rail. |

## 3. Content taxonomy (the rule that decides everything)

Every mini-game is exactly one of two kinds:

- **`tv` (channel)** — the game *is a screen*: pixel/canvas content (Snake,
  Pong, Dino-run, static noise). These render inside the shared CRT and are
  grouped contiguously. Switching between them is a **channel change**.
- **`standalone` (toy)** — the game *is a physical object with its own chrome*
  (Magic8Ball's ball body, a slot machine). The TV is absent; the object
  scrolls in from one side, scrolls out on exit.

**Invariant:** in the content array, all `render: 'tv'` entries must be
contiguous. Assert this at module load so a future edit can't silently break
the shared-TV illusion.

## 4. Information architecture / content model

Single source of truth, mirroring `src/data/resume.ts`.

`src/data/labs.ts`:

```ts
export type RenderType = 'tv' | 'standalone';
export type GameKey = 'snake' | 'pong' | 'dino' | 'magic8ball' | 'gacha';

export interface LabExperiment {
  id: string;            // 'snake'
  channel: number;       // 1-based; CH number in rail + TV overlay
  title: string;         // blog title
  teaser: string;        // 1–3 sentence brief
  status: 'RUNNING' | 'WRITING' | 'OFFLINE';
  accent: string;        // one of --nivoda-gold | --delhivery-red | --classplus-purple
  render: RenderType;
  game: GameKey;         // key → component in the game registry
  code: string;          // the core-logic snippet shown in the expand panel
  postSlug?: string;     // reserved for a future full article route
}

export const LAB_EXPERIMENTS: LabExperiment[] = [ /* see §11 launch set */ ];

// Assert TV entries are contiguous (throw in dev if violated).
```

## 5. HLD — component tree

```
Labs (page, rewritten)
├── LabsRail                  persistent index + scroll progress (replaces labs-progress dots + INIT list)
│    ├── RailHeader           "~/labs.exe"
│    ├── ChannelGroup "TV CHANNELS" → ChannelItem[]
│    ├── ChannelGroup "TOYS"        → ChannelItem[]
│    └── RailProgress         thin vertical fill of total scroll
└── LabsStage                 scroll container (ref = IntersectionObserver root, manual scrollTo target)
     ├── HeroScene            short boot intro (repurpose existing INIT vibe; optional but recommended)
     ├── TVZone               tall wrapper, height = (#tvBlogs) × 100vh
     │    ├── TVSet (sticky)  CRT frame + TVScreen
     │    │    └── TVScreen   channel host + static-burst FSM
     │    └── TVBlogScene[]   per-channel text + expandable code panel; drives activeChannel
     └── ToyScene[]           standalone toys (Magic8Ball, Gacha, …)
```

New shared pieces:

- `src/components/LabsRail/` — `index.tsx` + `style.css`
- `src/components/TVSet/` — CRT frame (antennas, knobs, scanlines) + hosts `TVScreen`
- `src/components/TVScreen/` — channel host + channel-change FSM
- `src/components/ChannelStatic/` — **extracted** from the current `RetroTVScreen` noise canvas; reused for the static burst
- `src/components/CodePanel/` — expandable code window
- `src/components/SceneText/` — title + teaser + expand toggle (used by both scene types)
- `src/components/games/Snake/`, `Pong/`, `DinoRun/`, `Gacha/` — each `index.tsx` + `style.css`
- `src/components/Magic8Ball/` — **unchanged**, reused as the first toy
- `src/hooks/useScrollProgress.ts` — per-element 0→1 progress
- `src/contexts/ScrollProgressContext.tsx` — single rAF loop driving all scenes (see §8)

## 6. Game component contract

Every game (TV or toy) implements one interface so loops can pause when
off-screen:

```ts
export interface GameProps {
  active: boolean;   // true only when its channel/scene is the active one
}
```

- rAF loops **must not run** when `active` is false (pause and cancel the frame).
- TV games are mounted by `TVScreen` only for the active channel (`key={channel}`),
  so inactive channel games are unmounted — no off-screen loops. (Fresh state on
  each channel change is acceptable.)
- Toy games mount when their scene is within ~1 viewport (IntersectionObserver),
  and stay mounted while interacting/expanding.
- Keep game state in `useRef`, not `useState`, inside the loop (no re-render per
  frame). Document this in the Snake code panel — it's the blog's whole point.

## 7. Scroll mechanic — hybrid (desktop)

`LabsStage` is the nested scroll container (NOT document scroll), exactly like
the current Labs/About pattern. Reuse: `root: stageRef.current` for the
IntersectionObserver, and the manual `container.scrollTo({ top: … })` for jumps
(`scrollIntoView` will not work — see `CLAUDE.md`).

- `scroll-snap-type: y mandatory` on `LabsStage`.
- Snap targets (`scroll-snap-align: start`, each `height: 100%` of the stage —
  **not `min-height`**, which breaks snap):
  - `HeroScene` (1)
  - each `TVBlogScene` slice inside `TVZone` (N) — the TV stays sticky across all of them
  - each `ToyScene` (1 each)
- `TVZone` height = `N × 100vh`; `TVSet` is `position: sticky; top: 0;
  height: calc(100vh - 56px)`. As each `TVBlogScene` slice crosses center
  (IntersectionObserver, threshold 0.5, root = stage), set `activeChannel`. The
  set never moves — only the channel content does.

Result: snap gives "always rest on one whole scene" (the feel you liked in
About), while the TV zone reads as one continuous pinned set whose channel
changes as you scroll.

## 8. Apple-style scroll animation

Drive motion with a normalized progress value per scene, written as a CSS
custom property so the animation itself lives in each component's `style.css`
(honors the "one CSS file per component" rule and keeps JS minimal).

- `ScrollProgressContext` runs **one** `requestAnimationFrame` loop. Scenes
  register their root element; each frame the loop reads `getBoundingClientRect`
  and writes `--p` (0→1, based on element center vs. stage center) onto that
  element. **Read in rAF, write only the CSS var — never trigger layout in the
  loop.** One shared loop, not one per scene.
- `useScrollProgress(ref)` is the thin registration hook.
- In `style.css`, map `--p` to `transform` / `opacity` only (e.g. title
  `translateY(calc((1 - var(--p)) * 24px))` + opacity ramp; staggered teaser;
  toy parallax). No `top`/`left`/`width` animation.
- Where available, prefer native CSS `animation-timeline: view()` behind
  `@supports`, with the rAF path as fallback.

## 9. TV channel-change FSM (`TVScreen`)

Model it like the existing Magic8Ball FSM.

```
states: 'live' | 'static'
on activeChannel change:
  set status = 'static'             // mount ChannelStatic noise + flash "CH 0X" overlay
  after ~280ms:
    set displayChannel = activeChannel
    set status = 'live'             // mount that channel's game (key=channel)
```

- Reuse `ChannelStatic` (extracted noise canvas) for the burst.
- Big pixel `CH 0X` overlay flashes during `static` (accent color of the target
  channel).
- Announce via `aria-live="polite"`: `Channel 2: Pong`.

## 10. Scene anatomy & the expandable code panel

Both scene types share `SceneText` + `CodePanel`. The **game is always mounted
and interactive**; expanding never covers or unmounts it.

- Desktop (≥900px): two columns — **game column** (TV or toy, fixed) and
  **text column** (title, teaser, `[ ▸ SHOW LOGIC ]` toggle). Expanding grows
  the text column downward with the `CodePanel`; the game column is untouched.
- Mobile (≤768px): stacked — game on top (kept above the fold), text + toggle
  below; expanding pushes content down, game stays reachable.
- `CodePanel`: a "code window" styled like the existing `blog-terminal`
  titlebar (red/yellow/green dots + filename, e.g. `snake.loop.ts`). Body is a
  monospace `<pre><code>` in `VT323`/pixel-mono with line numbers.
  - **Default:** plain styled `<pre>` (no new dependency).
  - **Optional upgrade:** `prism-react-renderer` for token colors (themeable via
    JS object, no global CSS — acceptable under the no-Tailwind rule). If used,
    note it in `CLAUDE.md` dependencies.
- Toggle is a real `<button aria-expanded>`; wire `haptics.tap()` on press
  (consistent with the rest of the app).

## 11. Launch content set (starter — adjust copy as desired)

**TV channels (contiguous):**

| CH | game | blog title | code panel shows |
| --- | --- | --- | --- |
| 01 | `snake` | A game loop in React without re-rendering | `useRef` state + single rAF loop, pause on inactive |
| 02 | `pong`  | Fixed-timestep loops & collision | accumulator timestep, AABB collision |
| 03 | `dino`  | Input latency: debounce vs throttle vs raw | hand-rolled `debounce`/`throttle`, jump handler |

**Toys (standalone, after channels):**

| game | blog title | code panel shows |
| --- | --- | --- |
| `magic8ball` | Modeling UI as a finite state machine | the existing `idle→tapping→counting→revealed` FSM |
| `gacha` | Build a tiny SWR cache (dedupe + stale-while-revalidate) | ~40-line in-memory cache hook |

Three contiguous channels then two toys exercises **both** transition types.

## 12. LabsRail spec

- `<nav aria-label="Lab channels">`, fixed left column on desktop (~220px),
  full stage height. Header `~/labs.exe`.
- Two labeled groups: `TV CHANNELS`, `TOYS`, divider line between.
- Each `ChannelItem`: `CH 0X` index, title, status badge in `accent`,
  `aria-current` when active. Active indicator = an absolutely-positioned bar
  whose `top` animates via CSS transition as `activeIdx` changes.
- Clicking jumps via the same manual `stageRef.current.scrollTo` used today.
- `RailProgress`: thin vertical fill = total stage scroll fraction.
- Mobile (≤768px): becomes a **sticky horizontal strip** directly under the
  56px navbar — horizontally scrollable chips, active chip auto-scrolled into
  view. Always visible.

## 13. Accessibility & reduced motion

- `prefers-reduced-motion: reduce`: disable `--p`-driven transforms and the
  channel static animation (jump straight to the new channel), stop the shared
  rAF, keep instant rail jumps. Provide this as a `@media` block **and** a JS
  guard in `ScrollProgressContext`.
- Channel changes + scene entry announced via `aria-live="polite"`.
- All games keyboard-operable; code toggle uses `aria-expanded`; manage focus
  on rail jumps.

## 14. Performance

- One shared rAF for scroll progress (§8), not per-scene.
- Inactive games unmounted/paused (§6) — no off-screen loops (the current
  `RetroTVScreen` runs forever; the extracted `ChannelStatic` must only run
  during a burst).
- Animate `transform`/`opacity` only; `will-change: transform` solely on the
  actively animating scene.

## 15. Mobile behavior (≤768px)

Consistent with the current Labs decision to drop snap on small screens:

- Disable `scroll-snap` and the sticky TV pin.
- TV channels stack: each `TVBlogScene` renders its TV inline with its game (no
  channel-change illusion needed on mobile).
- Toys stack normally; reduced/replaced parallax.
- Rail → sticky top strip (§12).

## 16. Migration steps (from current Labs)

1. Extract `RetroTVScreen`'s noise into `src/components/ChannelStatic/`; delete
   the always-on rAF behavior (run only on demand).
2. Build `LabsRail`; remove the `labs-progress` side dots and the INIT
   experiment list (the rail replaces both). Optionally keep a short
   `HeroScene` for the boot vibe.
3. Replace the `ARCADE.exe` placeholder with `TVZone` + real channel games.
4. Replace the `BLOG.exe` terminal placeholder: blogs are now per-scene, so
   repurpose its terminal animation as the `HeroScene` boot (or an outro), or
   drop it.
5. Move `Magic8Ball` into the first `ToyScene` (component itself unchanged).
6. Add `src/data/labs.ts`, the `ScrollProgressContext`, `useScrollProgress`,
   `TVSet`, `TVScreen`, `CodePanel`, `SceneText`, and the `games/*` components.
7. Keep `ExperienceCard`/About untouched.
8. **Update `CLAUDE.md`** (new Labs internals + any new dependency) and stage it
   with the `src/` changes — the pre-commit hook blocks the commit otherwise.

## 17. Acceptance checklist

- [ ] Rail always visible on desktop; sticky top strip on mobile; active item
      tracks scroll; clicking any item jumps to its scene.
- [ ] Desktop snaps to rest on each whole scene; snap + sticky disabled on mobile.
- [ ] TV stays put across its channels; channel change shows static burst +
      `CH 0X` flash; only the active channel's game is mounted.
- [ ] Toy scenes scroll in/out with parallax; toy stays interactive throughout.
- [ ] Every scene's game is always interactive; `SHOW LOGIC` reveals the code
      panel without covering or unmounting the game.
- [ ] `render: 'tv'` entries are contiguous (dev assertion passes).
- [ ] No `requestAnimationFrame` runs for an inactive game/scene.
- [ ] `prefers-reduced-motion` drops heavy motion; everything still navigable.
- [ ] Scroll feels smooth (transform/opacity only; no layout thrash).
- [ ] `npm run lint` and `npm run build` pass; `CLAUDE.md` updated.

## 18. Out of scope (v1)

Full article routes (`postSlug` reserved), per-game high-score persistence,
sound. Add later.
