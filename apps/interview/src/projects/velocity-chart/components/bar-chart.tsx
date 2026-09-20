import type { RefObject } from 'react';
import type { NiceScale, SeriesKey, Sprint, TooltipPlacement } from '../velocity-chart.types';
import { completionRate, percentOf } from '../utils/chart.utils';

interface BarChartProps {
  sprints: Sprint[];
  series: { key: SeriesKey; label: string }[];
  scale: NiceScale;
  average: number;
  activeIndex: number | null;
  placement: TooltipPlacement | null;
  plotRef: RefObject<HTMLDivElement>;
  tooltipRef: RefObject<HTMLDivElement>;
  registerGroup: (index: number, element: HTMLElement | null) => void;
  onShow: (index: number) => void;
  onHide: () => void;
}

/** Plain DOM + CSS: bar heights are percentages of the plot, so resizing needs no JavaScript. */
export function BarChart(props: BarChartProps) {
  const { sprints, series, scale, average, activeIndex, placement, plotRef, tooltipRef, registerGroup, onShow, onHide } =
    props;
  const active = activeIndex === null ? null : sprints[activeIndex];

  return (
    <div className="vc__chart">
      <div className="vc__y" aria-hidden="true">
        {scale.ticks.map((tick) => (
          <span key={tick} style={{ bottom: `${percentOf(tick, scale.max)}%` }}>
            {tick}
          </span>
        ))}
      </div>

      <div className="vc__plot" ref={plotRef} onMouseLeave={onHide}>
        {scale.ticks.map((tick) => (
          <div key={tick} className="vc__grid" style={{ bottom: `${percentOf(tick, scale.max)}%` }} />
        ))}
        {series.some((s) => s.key === 'completed') && (
          <div className="vc__avg" style={{ bottom: `${percentOf(average, scale.max)}%` }}>
            <span>avg {average}</span>
          </div>
        )}

        <div className="vc__groups">
          {sprints.map((sprint, index) => (
            <button
              key={sprint.id}
              type="button"
              ref={(element) => registerGroup(index, element)}
              className={`vc__group ${index === activeIndex ? 'is-active' : ''}`}
              aria-label={`${sprint.name}: committed ${sprint.committed}, completed ${sprint.completed} points`}
              onMouseEnter={() => onShow(index)}
              onFocus={() => onShow(index)}
              onBlur={onHide}
            >
              {series.map((s, barIndex) => (
                <span
                  key={s.key}
                  className={`vc__bar vc__bar--${s.key}`}
                  style={{ height: `${percentOf(sprint[s.key], scale.max)}%`, animationDelay: `${index * 30 + barIndex * 15}ms` }}
                />
              ))}
            </button>
          ))}
        </div>

        {/* ONE tooltip for the whole chart, moved to the active bar — not one per bar. */}
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`vc__tooltip ${active && placement ? 'is-visible' : ''}`}
          style={placement ? { left: placement.left, top: placement.top } : undefined}
        >
          {active && (
            <>
              <strong>{active.name}</strong>
              <span>Commitment: {active.committed} pts</span>
              <span>Completed: {active.completed} pts</span>
              <span className="vc__rate">{completionRate(active)}% of commitment</span>
            </>
          )}
        </div>
      </div>

      <div className="vc__x" aria-hidden="true">
        {sprints.map((sprint) => (
          <span key={sprint.id}>
            <span className="vc__x-long">{sprint.name}</span>
            <span className="vc__x-short">{sprint.name.replace('Sprint ', 'S')}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
