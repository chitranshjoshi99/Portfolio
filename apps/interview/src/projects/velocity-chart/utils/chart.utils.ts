import type { Box, NiceScale, Sprint, TooltipPlacement } from '../velocity-chart.types';

/**
 * Round a raw step up to 1, 2 or 5 × 10^k — the steps a human reads without effort
 * (Heckbert's "nice numbers"). 10.6 → 20, 7 → 10, 0.3 → 0.5, 1 → 1.
 */
export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / base; // in [1, 10)
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

/**
 * Axis for [0, maxValue]: top is a whole number of nice steps, so gridlines land on round values.
 * `integers`: story points are whole numbers — a 0.2-point gridline is noise, so the step floors at 1.
 */
export function niceScale(maxValue: number, targetTicks: number, integers = true): NiceScale {
  const safeMax = maxValue > 0 ? maxValue : 1; // an all-zero chart still needs an axis
  const rawStep = niceStep(safeMax / targetTicks);
  const step = integers ? Math.max(1, rawStep) : rawStep;
  const max = Math.ceil(safeMax / step - 1e-9) * step; // 1e-9: 60/20 must not become 3.0000000001 → 4 steps
  const ticks: number[] = [];
  for (let i = 0; i * step <= max + 1e-9; i += 1) ticks.push(Number((i * step).toFixed(10)));
  return { max, step, ticks };
}

/** Bar height as a percentage of the plot — CSS does the pixels, so the chart is responsive for free. */
export const percentOf = (value: number, max: number): number => (max > 0 ? (value / max) * 100 : 0);

export const completionRate = (sprint: Sprint): number =>
  sprint.committed > 0 ? Math.round((sprint.completed / sprint.committed) * 100) : 0;

/** Jira's "average velocity": mean completed points over the last `window` sprints, 1 decimal. */
export function averageVelocity(sprints: Sprint[], window: number): number {
  const recent = sprints.slice(-window);
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, sprint) => sum + sprint.completed, 0);
  return Math.round((total / recent.length) * 10) / 10;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(min, value), Math.max(min, max));

/**
 * Where the ONE shared tooltip goes. Anchor = the tallest bar of the hovered sprint.
 *   1. above it, centred, clamped inside the plot horizontally — if there is room above;
 *   2. otherwise beside it (right, else left), clamped inside the plot vertically.
 * Never below: under a bar is the x-axis, and the tooltip would cover the labels.
 */
export function placeTooltip(
  anchor: Box,
  tip: { width: number; height: number },
  container: { width: number; height: number },
  gap: number,
): TooltipPlacement {
  const above = anchor.top - tip.height - gap;
  if (above >= 0) {
    const centred = anchor.left + anchor.width / 2 - tip.width / 2;
    return { left: clamp(centred, 0, container.width - tip.width), top: above, side: 'above' };
  }
  const top = clamp(anchor.top, 0, container.height - tip.height);
  const right = anchor.left + anchor.width + gap;
  if (right + tip.width <= container.width) return { left: right, top, side: 'right' };
  return { left: clamp(anchor.left - gap - tip.width, 0, container.width - tip.width), top, side: 'left' };
}
