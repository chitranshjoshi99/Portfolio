import { BarChart } from './components/bar-chart';
import { DataTable } from './components/data-table';
import { AVERAGE_WINDOW, RANGE_OPTIONS, SERIES } from './constants/velocity-chart.constants';
import { useVelocityChart } from './hooks/use-velocity-chart';
import './velocity-chart.css';

export default function VelocityChartPage() {
  const c = useVelocityChart();

  return (
    <section className="vc">
      <header className="vc__head">
        <div>
          <h2 className="vc__title">Velocity chart</h2>
          <p className="vc__sub">
            Average velocity (last {AVERAGE_WINDOW}): <b>{c.average} pts</b>
          </p>
        </div>
        <div className="vc__controls">
          <div className="vc__legend" role="group" aria-label="Series">
            {SERIES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`vc__key vc__key--${s.key}`}
                aria-pressed={!c.hidden.has(s.key)}
                onClick={() => c.toggleSeries(s.key)}
              >
                <span className="vc__swatch" aria-hidden="true" />
                {s.label}
              </button>
            ))}
          </div>
          <label className="vc__field">
            Last
            <select value={c.range} onChange={(event) => c.setRange(Number(event.target.value))}>
              {RANGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} sprints
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="vc__btn" onClick={c.randomise}>
            Random data
          </button>
          <button type="button" className="vc__btn" onClick={c.reset}>
            Mock data
          </button>
        </div>
      </header>

      {c.series.length === 0 ? (
        <p className="vc__empty">Both series are hidden — turn one back on in the legend.</p>
      ) : (
        <BarChart
          sprints={c.sprints}
          series={c.series}
          scale={c.scale}
          average={c.average}
          activeIndex={c.activeIndex}
          placement={c.placement}
          plotRef={c.plotRef}
          tooltipRef={c.tooltipRef}
          registerGroup={c.registerGroup}
          onShow={c.show}
          onHide={c.hide}
        />
      )}

      <DataTable sprints={c.sprints} />
    </section>
  );
}
