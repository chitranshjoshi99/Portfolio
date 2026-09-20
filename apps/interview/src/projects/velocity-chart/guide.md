# Jira Velocity Bar Chart — Interview Build Guide

Build Jira's velocity chart from mock data: for each sprint, a grey *commitment* bar and a green
*completed* bar side by side, a y-axis with round gridlines, sprint labels, a tooltip on each bar, a
legend that toggles series, the average velocity line, and a layout that works from a wide dashboard down
to a phone. Bars are plain `<div>`s sized in CSS percentages — no chart library, no canvas, no SVG. Plain
JavaScript, fresh sandbox. Target 45–60 minutes.

Reported at Atlassian as: *"Create UI as per the given image and mock data (it was a bar chart). Needed to
create a bar chart with the provided mock data, show a tooltip on each bar, and make it responsive"* (P50,
browser coding round, 2025), *"Code a bar chart"* (senior FE phone screen), *"Given a JavaScript data set,
produce a bar graph via CSS and styling to represent the data"*, *"Create a bar chart with the following
details…"*, and Devtools' *"Interactive JIRA Velocity Bar Chart — Atlassian browser coding round"*.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| Rendering | Flex row of groups; bar height = `value / axisMax` as a **percentage**. The browser does the pixels, so resizing needs no JavaScript. |
| Axis | **Nice 1-2-5 ticks** with an integer floor: `53` → axis `0, 20, 40, 60`, never `0, 10.6, 21.2…` and never `0.2` story points. |
| Tooltip | **One shared tooltip**, positioned from layout offsets of the hovered group: above the tallest bar if it fits, else beside it, clamped inside the plot, re-placed on resize. |
| Responsive | Container queries (not viewport media queries): short labels (`S42`) and a shorter plot when the chart itself is narrow. |
| Accessibility | Each sprint is a focusable button with a full `aria-label`; the same numbers as a real `<table>` behind a disclosure. |
| Discussed, not built | Thousands of bars (canvas), zoom/brush, SVG vs HTML trade-off, animation on data change. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements from the image: series, axis, tooltip content, breakpoints |
| 5–10 | HLD: percentage layout, one tooltip |
| 10–20 | Bars on screen from the mock data |
| 20–28 | **The axis: nice ticks — the algorithm section** |
| 28–40 | **Tooltip: positioning and clamping** |
| 40–48 | Legend toggles, average line |
| 48–55 | Responsive + a11y |
| 55–60 | Demo, cross-questions |

---

## 0. Sandbox setup

```text
src/
  App.jsx
  styles.css      # the one place CSS matters in this question — bars ARE CSS
```

Target split (this repo):

```text
velocity-chart/
  index.tsx                             # header, legend, range select, chart, data table
  velocity-chart.types.ts               # Sprint, SeriesKey, NiceScale, Box, TooltipPlacement
  velocity-chart.css                    # bars, grid, tooltip, container queries, grow animation
  constants/velocity-chart.constants.ts # SPRINTS (the mock data), SERIES, ranges, gap
  utils/chart.utils.ts                  # pure: niceStep, niceScale, percentOf, completionRate,
                                        #       averageVelocity, placeTooltip
  utils/chart.utils.check.ts
  hooks/use-velocity-chart.ts           # range, hidden series, active index, placement, resize
  components/bar-chart.tsx              # axis, gridlines, groups, bars, the tooltip
  components/data-table.tsx             # accessible table of the same numbers
```

---

## 1. Requirement gathering (5 minutes) — read the image out loud

1. **"Two series side by side, or stacked?"**
   Velocity is *commitment vs completed* — side by side. Stacked would add them, which is meaningless here.
   *Default: grouped bars, commitment grey, completed green.*
2. **"Does the y-axis start at zero? What are the gridlines?"**
   Bar length must start at zero or the chart lies. Gridline values decide the algorithm below.
   *Default: zero-based, round gridlines.*
3. **"What does the tooltip show, and on what — hover, focus, tap?"**
   *Default: sprint name, both values, completion %; hover, keyboard focus and tap.*
4. **"How many sprints? Is the dataset ever large?"**
   Decides HTML bars vs canvas. *Default: last 6/8/12 sprints — HTML bars.*
5. **"'Responsive' — what should change at small widths?"**
   *Default: bars stay, labels shorten, plot height shrinks; driven by the chart's width, not the window's.*
6. **"Can the user hide a series?"** *Default: legend toggles; axis rescales to what is visible.*
7. **"Average line?"** Jira shows average velocity. *Default: mean of the last 3 completed values.*

Plan:

> "Each sprint is a flex column; each bar's height is its value as a percentage of the axis maximum, so the
> browser handles resizing. The axis maximum is a 'nice' number — 1, 2 or 5 times a power of ten — so
> gridlines land on round values. One tooltip for the whole chart, positioned against the hovered sprint
> and clamped inside the plot. The same numbers go in a real table for screen readers."

---

## 2. High-level design (HLD)

```text
 SPRINTS (mock) ──slice(-range)──▶ sprints ──┐
 hidden series ─────────────────▶ series ────┤
                                              ▼
                  scale = niceScale(max of visible values, 5)   → { max, step, ticks }
                  average = mean(completed of last 3)
                                              │
 ┌────────────────────────────── .vc__plot (position: relative) ──────────────────────────────┐
 │  gridlines: bottom = tick/max %          average line: bottom = avg/max %                  │
 │  .vc__groups (absolute, inset 0, flex, align-items: flex-end)                              │
 │     <button.vc__group aria-label> <span.bar height=committed/max%> <span.bar …completed> │
 │  ONE <div role=tooltip> at placeTooltip(anchor = tallest bar of hovered group)              │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
          ▲ hover / focus → activeIndex → useLayoutEffect measures offsets → placement
          ▲ ResizeObserver(plot) → re-place an open tooltip
```

Claims:

- **Percentages, not pixels.** Pixel heights mean JS on every resize; percentage heights inside a fixed-height
  plot resize for free.
- **The axis max is not the data max.** Axis top `= ceil(dataMax / step) · step` with a nice step.
- **One tooltip, not N.** Per-bar tooltips are N extra DOM nodes and N positioning problems.
- **Positioning uses layout offsets.** `offsetTop/Left` ignore CSS transforms, so the grow animation cannot
  make the tooltip land in the wrong place mid-animation.

---

## 3. Low-level design (LLD)

### State

```js
const [all, setAll]                 = useState(SPRINTS);   // mock data (or randomised)
const [range, setRange]             = useState(8);         // last N sprints
const [hidden, setHidden]           = useState(new Set()); // series switched off in the legend
const [activeIndex, setActiveIndex] = useState(null);      // sprint the tooltip describes
const [placement, setPlacement]     = useState(null);      // { left, top, side }
const [plotWidth, setPlotWidth]     = useState(0);         // only to re-place on resize
```

### Refs

```js
const plotRef    = useRef(null);       // the positioning context
const tooltipRef = useRef(null);       // its rendered size is an input to placement
const groupRefs  = useRef(new Map());  // index -> sprint button
```

### Pure function signatures

```js
niceStep(rough)                              -> 1 | 2 | 5 × 10^k
niceScale(maxValue, targetTicks, integers)   -> { max, step, ticks }
percentOf(value, max)                        -> 0..100
completionRate(sprint)                       -> % (rounded)
averageVelocity(sprints, window)             -> points, 1 decimal
placeTooltip(anchor, tipSize, plotSize, gap) -> { left, top, side: 'above' | 'right' | 'left' }
```

---

## 4. The data model

```json
[
  { "id": "s41", "name": "Sprint 41", "committed": 53, "completed": 48 },
  { "id": "s42", "name": "Sprint 42", "committed": 46, "completed": 45 }
]
```

- `committed` = story points when the sprint started, `completed` = done at close. Both are integers.
- Series are **keys into the record** (`sprint[series.key]`), so adding a third series (e.g. "added
  mid-sprint") is a config change, not a render change.

**Fork — HTML bars, SVG, or canvas?**

| | HTML/CSS bars | SVG | Canvas |
| --- | --- | --- | --- |
| Responsive | free (percentages, flex) | `viewBox` scaling (text scales too) | redraw on resize |
| Events / focus / a11y | native elements | per-element, needs roles | hit-testing by hand |
| Hundreds of bars | fine | fine | fine |
| Tens of thousands | too many nodes | too many nodes | **yes** |
| Matches "via CSS" | **yes** | no | no |

The prompt says CSS; the table says why that is also the right call for 6–12 sprints.

---

## 5. Pass 1 — bars on screen (target: 8 minutes)

```jsx
const max = Math.max(...sprints.flatMap((s) => [s.committed, s.completed]));

<div className="plot">                      {/* height: 280px; display: flex; align-items: flex-end */}
  {sprints.map((s) => (
    <div key={s.id} className="group">
      <span className="bar bar--committed" style={{ height: `${(s.committed / max) * 100}%` }} />
      <span className="bar bar--completed" style={{ height: `${(s.completed / max) * 100}%` }} />
    </div>
  ))}
</div>
```

On screen in 5 minutes. Point at the flaw: the tallest bar touches the top and gridlines at `max/4` would be
at `13.25` — unreadable. That is the next pass.

---

## 6. Pass 2 — the axis (target: 8 minutes)

### 6.1 Ladder A — choosing the axis maximum and step

#### A0 — axis max = data max, step = max / ticks

`53` → ticks `0, 13.25, 26.5, 39.75, 53`. Correct, unreadable, and the tallest bar hits the ceiling.

#### A1 — round the max up to the next 10, step = 10

`53` → `60`, ticks every 10: fine for this data. `530` → 54 gridlines. `3` → axis `0–10` with the bars
squashed into the bottom third. The step does not adapt to the magnitude.

#### A2 — nice 1-2-5 step, integer floor ← **build this**

```js
function niceStep(rough) {
  if (!(rough > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / base;                   // 1 ≤ fraction < 10
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

function niceScale(maxValue, targetTicks, integers = true) {
  const safeMax = maxValue > 0 ? maxValue : 1;     // all-zero data still needs an axis
  const raw = niceStep(safeMax / targetTicks);
  const step = integers ? Math.max(1, raw) : raw;  // no 0.2-point gridlines
  const max = Math.ceil(safeMax / step - 1e-9) * step;
  const ticks = [];
  for (let i = 0; i * step <= max + 1e-9; i++) ticks.push(Number((i * step).toFixed(10)));
  return { max, step, ticks };
}
```

| Rung | `53` | `530` | `3` | `0` |
| --- | --- | --- | --- | --- |
| A0 max, max/4 | 0, 13.25 … 53 | 0, 132.5 … 530 | 0, 0.75 … 3 | divide by zero |
| A1 round to 10 | 0, 10 … 60 | 54 gridlines | 0, 10 (squashed) | 0 |
| **A2 nice + integer** | **0, 20, 40, 60** | **0, 200, 400, 600** | **0, 1, 2, 3** | **0, 1** |

What changed: the step is derived from the **magnitude** of the data (`log10`) instead of being a constant,
and snapped to the 1-2-5 sequence people read without effort. The integer floor exists because story points
are whole numbers — the check file caught `niceScale(0)` producing `0, 0.2, 0.4…` before the floor was
added. `O(1)` to compute, `O(ticks)` to list. This is Heckbert's nice-numbers method, not dynamic
programming.

The `1e-9` epsilons stop floating point from turning `60 / 20` into `3.0000000001` and adding a phantom
fourth step.

---

## 7. Pass 3 — the tooltip (target: 12 minutes)

### 7.1 Ladder B — tooltip strategy

| Rung | DOM nodes | Keyboard / touch | Stays inside the chart | Covers the bar |
| --- | --- | --- | --- | --- |
| B0 `title` attribute | 0 | no / no | browser decides | n/a |
| B1 a tooltip inside every bar, CSS `:hover` | N | focus-within only | **no** (edge bars overflow) | often |
| **B2 one tooltip, measured, clamped, side fallback** | **1** | **yes** | **yes** | **no** |

```js
function placeTooltip(anchor, tip, container, gap) {
  const above = anchor.top - tip.height - gap;
  if (above >= 0) {                                         // 1. above the tallest bar, centred
    const centred = anchor.left + anchor.width / 2 - tip.width / 2;
    return { left: clamp(centred, 0, container.width - tip.width), top: above, side: 'above' };
  }
  const top = clamp(anchor.top, 0, container.height - tip.height);   // 2. beside it
  const right = anchor.left + anchor.width + gap;
  if (right + tip.width <= container.width) return { left: right, top, side: 'right' };
  return { left: clamp(anchor.left - gap - tip.width, 0, container.width - tip.width), top, side: 'left' };
}
```

Measure in `useLayoutEffect` — after React has rendered the tooltip's content (its size depends on it) and
before the browser paints (so it never flashes in the old position):

```js
useLayoutEffect(() => {
  if (activeIndex === null) return setPlacement(null);
  const group = groupRefs.current.get(activeIndex);
  const bars = [...group.children];
  const bottom = group.offsetTop + group.offsetHeight;
  const top = Math.min(...bars.map((bar) => bar.offsetTop));        // tallest bar, not the group
  setPlacement(placeTooltip(
    { left: group.offsetLeft, top, width: group.offsetWidth, height: bottom - top },
    { width: tooltipRef.current.offsetWidth, height: tooltipRef.current.offsetHeight },
    { width: plotRef.current.clientWidth, height: plotRef.current.clientHeight },
    8,
  ));
}, [activeIndex, sprints, series, plotWidth]);
```

Three bugs this version avoids, all of which the first draft of this project had and the browser check
caught:

1. **Anchoring on the group.** The group is full height, so "no room above" was always true and the tooltip
   always flipped *below* — onto the x-axis labels.
2. **`getBoundingClientRect` + a border.** Client rects include the plot's 1px border; absolute positions
   are relative to the padding box. Offsets avoid the conversion.
3. **Stale after resize.** An open tooltip kept desktop coordinates on a phone. A `ResizeObserver` on the
   plot feeds `plotWidth` into the effect.

---

## 8. Pass 4 — legend, average, responsive, a11y (target: 8 minutes)

- **Legend** buttons with `aria-pressed`; the axis rescales to the visible series (hide *commitment* and
  the completed bars use the full height).
- **Average line** at `bottom: average / max %` — one absolutely positioned div, same scale as the bars.
- **Container queries**: `.vc { container-type: inline-size }` and `@container (max-width: 620px)` swaps
  `Sprint 42` for `S42`. A viewport media query would get it wrong when the chart sits in a sidebar.
- **Animation**: bars grow with `transform: scaleY` from `transform-origin: bottom`, disabled under
  `prefers-reduced-motion`.
- **A11y**: each sprint group is a `<button>` with *"Sprint 42: committed 46, completed 45 points"*; hover
  and focus both show the tooltip; and a `<details>` holds a real `<table>` with a caption — the honest
  accessible representation of a chart is its data.

---

## 9. The single-file version — what you actually type

The only styles here are data-driven inline heights/positions — everything else assumes the CSS classes
exist.

```jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/* ───────────── constants/velocity-chart.constants.js ───────────── */

const SPRINTS = [
  { id: 's35', name: 'Sprint 35', committed: 36, completed: 36 },
  { id: 's36', name: 'Sprint 36', committed: 48, completed: 39 },
  { id: 's37', name: 'Sprint 37', committed: 44, completed: 43 },
  { id: 's38', name: 'Sprint 38', committed: 51, completed: 37 },
  { id: 's39', name: 'Sprint 39', committed: 39, completed: 38 },
  { id: 's40', name: 'Sprint 40', committed: 47, completed: 44 },
  { id: 's41', name: 'Sprint 41', committed: 53, completed: 48 },
  { id: 's42', name: 'Sprint 42', committed: 46, completed: 45 },
];
const SERIES = [{ key: 'committed', label: 'Commitment' }, { key: 'completed', label: 'Completed' }];

/* ───────────── utils/chart.utils.js — pure ───────────── */

function niceStep(rough) {
  if (!(rough > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(rough));
  const f = rough / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base;
}

function niceScale(maxValue, targetTicks = 5) {
  const safeMax = maxValue > 0 ? maxValue : 1;
  const step = Math.max(1, niceStep(safeMax / targetTicks));   // story points are integers
  const max = Math.ceil(safeMax / step - 1e-9) * step;
  const ticks = [];
  for (let i = 0; i * step <= max + 1e-9; i++) ticks.push(i * step);
  return { max, step, ticks };
}

const percentOf = (value, max) => (max > 0 ? (value / max) * 100 : 0);
const completionRate = (s) => (s.committed ? Math.round((s.completed / s.committed) * 100) : 0);
const averageVelocity = (sprints, window = 3) => {
  const recent = sprints.slice(-window);
  return recent.length ? Math.round((recent.reduce((t, s) => t + s.completed, 0) / recent.length) * 10) / 10 : 0;
};

const clamp = (v, min, max) => Math.min(Math.max(min, v), Math.max(min, max));

function placeTooltip(anchor, tip, box, gap = 8) {
  const above = anchor.top - tip.height - gap;
  if (above >= 0) {
    return { left: clamp(anchor.left + anchor.width / 2 - tip.width / 2, 0, box.width - tip.width), top: above };
  }
  const top = clamp(anchor.top, 0, box.height - tip.height);
  const right = anchor.left + anchor.width + gap;
  if (right + tip.width <= box.width) return { left: right, top };
  return { left: clamp(anchor.left - gap - tip.width, 0, box.width - tip.width), top };
}

/* ───────────── hooks/use-velocity-chart.js ───────────── */

function useVelocityChart() {
  const [hidden, setHidden] = useState(new Set());
  const [activeIndex, setActiveIndex] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const plotRef = useRef(null);
  const tooltipRef = useRef(null);
  const groupRefs = useRef(new Map());

  const series = SERIES.filter((s) => !hidden.has(s.key));
  const scale = useMemo(() => {
    const values = SPRINTS.flatMap((sprint) => series.map((s) => sprint[s.key]));
    return niceScale(values.length ? Math.max(...values) : 0);
  }, [hidden]);                                                 // axis follows what is VISIBLE

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setPlotWidth(plot.clientWidth));
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {                                       // after render, before paint
    if (activeIndex === null) { setPlacement(null); return; }
    const group = groupRefs.current.get(activeIndex);
    const bars = [...group.children];
    const bottom = group.offsetTop + group.offsetHeight;
    const top = bars.length ? Math.min(...bars.map((b) => b.offsetTop)) : bottom; // tallest bar
    setPlacement(placeTooltip(
      { left: group.offsetLeft, top, width: group.offsetWidth, height: bottom - top },
      { width: tooltipRef.current.offsetWidth, height: tooltipRef.current.offsetHeight },
      { width: plotRef.current.clientWidth, height: plotRef.current.clientHeight },
    ));
  }, [activeIndex, hidden, plotWidth]);

  const toggle = (key) => setHidden((h) => { const n = new Set(h); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return { series, scale, hidden, toggle, activeIndex, setActiveIndex, placement, plotRef, tooltipRef, groupRefs,
    average: averageVelocity(SPRINTS) };
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const c = useVelocityChart();
  const active = c.activeIndex === null ? null : SPRINTS[c.activeIndex];

  return (
    <section className="chart">
      <div className="legend">
        {SERIES.map((s) => (
          <button key={s.key} aria-pressed={!c.hidden.has(s.key)} onClick={() => c.toggle(s.key)}>{s.label}</button>
        ))}
        <span>Average velocity: {c.average}</span>
      </div>

      <div className="y-axis" aria-hidden="true">
        {c.scale.ticks.map((t) => <span key={t} style={{ bottom: `${percentOf(t, c.scale.max)}%` }}>{t}</span>)}
      </div>

      <div className="plot" ref={c.plotRef} onMouseLeave={() => c.setActiveIndex(null)}>
        {c.scale.ticks.map((t) => <div key={t} className="gridline" style={{ bottom: `${percentOf(t, c.scale.max)}%` }} />)}
        <div className="avg-line" style={{ bottom: `${percentOf(c.average, c.scale.max)}%` }} />

        <div className="groups">
          {SPRINTS.map((sprint, i) => (
            <button
              key={sprint.id}
              ref={(el) => { if (el) c.groupRefs.current.set(i, el); else c.groupRefs.current.delete(i); }}
              className="group"
              aria-label={`${sprint.name}: committed ${sprint.committed}, completed ${sprint.completed} points`}
              onMouseEnter={() => c.setActiveIndex(i)}
              onFocus={() => c.setActiveIndex(i)}
              onBlur={() => c.setActiveIndex(null)}
            >
              {c.series.map((s) => (
                <span key={s.key} className={`bar bar--${s.key}`} style={{ height: `${percentOf(sprint[s.key], c.scale.max)}%` }} />
              ))}
            </button>
          ))}
        </div>

        <div ref={c.tooltipRef} role="tooltip" className={active && c.placement ? 'tooltip is-visible' : 'tooltip'}
          style={c.placement ?? undefined}>
          {active && (
            <>
              <strong>{active.name}</strong>
              <span>Commitment: {active.committed}</span>
              <span>Completed: {active.completed}</span>
              <span>{completionRate(active)}% of commitment</span>
            </>
          )}
        </div>
      </div>

      <div className="x-axis" aria-hidden="true">
        {SPRINTS.map((s) => <span key={s.id}>{s.name}</span>)}
      </div>

      <details>
        <summary>View data as a table</summary>
        <table>
          <thead><tr><th>Sprint</th><th>Commitment</th><th>Completed</th></tr></thead>
          <tbody>{SPRINTS.map((s) => <tr key={s.id}><th>{s.name}</th><td>{s.committed}</td><td>{s.completed}</td></tr>)}</tbody>
        </table>
      </details>
    </section>
  );
}
```

**Build it in this order:** bars from the data with `max = dataMax` (on screen) → `niceScale` and switch the
bars and gridlines to `scale.max` → y-axis labels → the shared tooltip with `placeTooltip` → legend + axis
rescale → average line → container query + labels → aria-labels and the table.

Narrate the two lines that carry the question: `height: value / scale.max * 100 + '%'` — *"the browser does
the layout, so responsive is free"* — and `Math.min(...bars.map((b) => b.offsetTop))` — *"anchor on the
tallest bar, using offsets so transforms and borders can't move it."*

---

## 10. Verification

```bash
node src/projects/velocity-chart/utils/chart.utils.check.ts
```

It checks the nice-step table (10.6→20, 7→10, 2.1→5, 0.3→0.5), the mock data's axis (`0,20,40,60`), that an
exact multiple is not bumped, that all-zero and tiny data get integer axes, and — over every max from 1 to
5000 at 4/5/6 target ticks — that the axis covers the data with no wasted top step, the step is 1/2/5×10ᵏ,
and there are 2–11 ticks. Then average velocity, completion rate, and all three tooltip branches (above
with left/right clamping, beside-right, beside-left, vertical clamp).

Demo script:

1. Mock data, last 8 sprints → axis `0 20 40 60`, average line labelled `avg 45.7`.
2. Hover the first sprint → tooltip above its bars, clamped to the left edge.
3. Hover Sprint 41 (the tallest) → no room above → tooltip beside it, inside the plot.
4. Tab through the bars → the tooltip follows focus.
5. Hide *Commitment* → axis rescales, completed bars grow.
6. *Random data* a few times → axis steps adapt (`0,50,100` etc.).
7. Phone width → `S35…S42` labels; hovering still keeps the tooltip inside.
8. Open *View data as a table*.

---

## 11. Cross-questions and answers

**"10 000 bars?"**
HTML bars stop being reasonable around a few thousand nodes. Switch to canvas: draw bars in a loop, keep an
array of bar rectangles, hit-test the pointer against it (binary search by x) to drive the same single
tooltip. Aggregate first if pixels < bars — 10 000 bars in 800px is 12 bars per pixel.

**"Why not a chart library?"**
In production, probably yes (Recharts, visx, ECharts) — axes, scales and a11y are solved. In the interview
the point is the scale and layout reasoning; in production, the point is not maintaining it.

**"Negative values?"**
The axis becomes `[niceFloor(min), niceCeil(max)]` with a zero baseline inside it; bars grow up or down from
the zero line (`bottom` for positive, `top` for negative).

**"Animate data changes, not just mount?"**
Transition `height` (or `transform: scaleY` for compositor-only animation) when values change; keyed by
sprint id so React reuses the same element and CSS can interpolate.

**"How do you test it?"**
The scale and placement are pure — property tests over ranges of inputs (the check file). Visual regression
(Playwright screenshots) for the CSS. Component tests: focusing a bar exposes the tooltip text; the table has
the same numbers as the aria-labels.

**"What does the chart look like to a screen reader?"**
A group of buttons, each announcing its sprint and both values, plus a real table. Colour is never the only
carrier: the legend has text, and the tooltip names the series.
