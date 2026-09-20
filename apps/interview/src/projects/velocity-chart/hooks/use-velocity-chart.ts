import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AVERAGE_WINDOW, SERIES, SPRINTS, TARGET_TICKS, TOOLTIP_GAP } from '../constants/velocity-chart.constants';
import type { SeriesKey, Sprint, TooltipPlacement } from '../velocity-chart.types';
import { averageVelocity, niceScale, placeTooltip } from '../utils/chart.utils';

const randomSprints = (): Sprint[] =>
  SPRINTS.map((sprint) => {
    const committed = 20 + Math.round(Math.random() * 90);
    return { ...sprint, committed, completed: Math.round(committed * (0.4 + Math.random() * 0.6)) };
  });

export function useVelocityChart() {
  const [all, setAll] = useState<Sprint[]>(SPRINTS);
  const [range, setRange] = useState(8);
  const [hidden, setHidden] = useState<ReadonlySet<SeriesKey>>(() => new Set());
  /** Which sprint the ONE shared tooltip is describing; null = hidden. */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null);

  const plotRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef(new Map<number, HTMLElement>());
  /** Plot width, tracked only so an open tooltip re-places itself when the chart resizes. */
  const [plotWidth, setPlotWidth] = useState(0);

  // Re-attach when the chart remounts (it unmounts while both series are hidden).
  const chartMounted = !hidden.has('committed') || !hidden.has('completed');
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setPlotWidth(plot.clientWidth));
    observer.observe(plot);
    return () => observer.disconnect();
  }, [chartMounted]);

  const sprints = useMemo(() => all.slice(-range), [all, range]);
  const series = useMemo(() => SERIES.filter((s) => !hidden.has(s.key)), [hidden]);

  // The axis follows what is VISIBLE — hiding "committed" rescales to the completed bars.
  const scale = useMemo(() => {
    const values = sprints.flatMap((sprint) => series.map((s) => sprint[s.key]));
    return niceScale(values.length ? Math.max(...values) : 0, TARGET_TICKS);
  }, [series, sprints]);

  const average = useMemo(() => averageVelocity(sprints, AVERAGE_WINDOW), [sprints]);

  // Measure after render, before paint: the tooltip needs its own size, which only exists once rendered.
  useLayoutEffect(() => {
    if (activeIndex === null) return setPlacement(null);
    const plot = plotRef.current;
    const group = groupRefs.current.get(activeIndex);
    const tip = tooltipRef.current;
    if (!plot || !group || !tip) return;
    // Layout offsets, not getBoundingClientRect: they ignore the grow animation's scaleY transform, and
    // they are already relative to the bars' layer, which fills the plot's padding box.
    // Anchor on the tallest bar, not the group — the group is full height and would always flip below.
    const bars = Array.from(group.children) as HTMLElement[];
    const groupBottom = group.offsetTop + group.offsetHeight;
    const top = bars.length ? Math.min(...bars.map((bar) => bar.offsetTop)) : groupBottom;
    setPlacement(
      placeTooltip(
        { left: group.offsetLeft, top, width: group.offsetWidth, height: groupBottom - top },
        { width: tip.offsetWidth, height: tip.offsetHeight },
        { width: plot.clientWidth, height: plot.clientHeight },
        TOOLTIP_GAP,
      ),
    );
  }, [activeIndex, sprints, series, plotWidth]);

  const registerGroup = useCallback((index: number, element: HTMLElement | null) => {
    if (element) groupRefs.current.set(index, element);
    else groupRefs.current.delete(index);
  }, []);

  const toggleSeries = useCallback((key: SeriesKey) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return {
    sprints,
    series,
    hidden,
    scale,
    average,
    range,
    setRange,
    activeIndex,
    placement,
    show: setActiveIndex,
    hide: () => setActiveIndex(null),
    toggleSeries,
    randomise: () => setAll(randomSprints()),
    reset: () => setAll(SPRINTS),
    plotRef,
    tooltipRef,
    registerGroup,
  };
}
