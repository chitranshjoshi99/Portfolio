/**
 * Plain assertions — run with `node src/projects/velocity-chart/utils/chart.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import { SPRINTS } from '../constants/velocity-chart.constants.ts';
import { averageVelocity, completionRate, niceScale, niceStep, percentOf, placeTooltip } from './chart.utils.ts';

// --- nice steps ---------------------------------------------------------------------------

assert.equal(niceStep(10.6), 20);
assert.equal(niceStep(7), 10);
assert.equal(niceStep(1), 1);
assert.equal(niceStep(2.1), 5);
assert.equal(niceStep(0.3), 0.5);
assert.equal(niceStep(0), 1);

// --- the axis for the mock data -----------------------------------------------------------

const top = Math.max(...SPRINTS.flatMap((s) => [s.committed, s.completed]));
assert.deepEqual(niceScale(top, 5), { max: 60, step: 20, ticks: [0, 20, 40, 60] });
assert.deepEqual(niceScale(60, 5).max, 60, 'an exact multiple is not bumped a step');
assert.deepEqual(niceScale(0, 5), { max: 1, step: 1, ticks: [0, 1] }, 'all-zero data still has an axis');
assert.deepEqual(niceScale(3, 5), { max: 3, step: 1, ticks: [0, 1, 2, 3] }, 'no fractional story points');
assert.equal(niceScale(3, 5, false).step, 1, 'non-integer mode: 0.6 rounds to 1 anyway');
assert.equal(niceScale(0.8, 5, false).step, 0.2, 'non-integer mode allows fractional steps');

// --- properties over many maxima: covers the data, round steps, sane tick count -------------

const mantissas = new Set([1, 2, 5]);
for (let value = 1; value <= 5000; value += 7) {
  for (const target of [4, 5, 6]) {
    const { max, step, ticks } = niceScale(value, target);
    assert.ok(max >= value, `max ${max} covers ${value}`);
    assert.ok(max - step < value, `no wasted top step for ${value}`);
    const mantissa = step / 10 ** Math.floor(Math.log10(step));
    assert.ok(mantissas.has(Math.round(mantissa)), `step ${step} is 1/2/5×10^k`);
    assert.ok(ticks.length >= 2 && ticks.length <= 11, `${ticks.length} ticks for ${value}`);
    assert.equal(ticks[ticks.length - 1], max);
    ticks.forEach((tick, i) => assert.equal(tick, Number((i * step).toFixed(10))));
  }
}

// --- scaling + metrics --------------------------------------------------------------------

assert.equal(percentOf(30, 60), 50);
assert.equal(percentOf(5, 0), 0);
assert.equal(completionRate({ id: 'x', name: 'x', committed: 40, completed: 30 }), 75);
assert.equal(completionRate({ id: 'x', name: 'x', committed: 0, completed: 3 }), 0);
assert.equal(averageVelocity(SPRINTS, 3), 45.7); // (44 + 48 + 45) / 3
assert.equal(averageVelocity([], 3), 0);

// --- tooltip: centred, clamped, flipped ------------------------------------------------------

const container = { width: 600, height: 300 };
const tip = { width: 160, height: 60 };
assert.deepEqual(placeTooltip({ left: 300, top: 120, width: 20, height: 180 }, tip, container, 8), {
  left: 230,
  top: 52,
  side: 'above',
});
assert.equal(placeTooltip({ left: 2, top: 120, width: 20, height: 180 }, tip, container, 8).left, 0, 'clamped left');
assert.equal(
  placeTooltip({ left: 590, top: 120, width: 10, height: 180 }, tip, container, 8).left,
  440,
  'clamped right',
);
// tall bar, no room above → beside it on the right, vertically clamped into the plot
assert.deepEqual(placeTooltip({ left: 300, top: 20, width: 20, height: 280 }, tip, container, 8), {
  left: 328,
  top: 20,
  side: 'right',
});
// tall bar at the right edge → beside it on the left
assert.deepEqual(placeTooltip({ left: 560, top: 10, width: 30, height: 290 }, tip, container, 8), {
  left: 392,
  top: 10,
  side: 'left',
});
// a tooltip taller than the space below the anchor is pulled up to stay inside
assert.equal(placeTooltip({ left: 300, top: 5, width: 20, height: 295 }, { width: 160, height: 400 }, container, 8).top, 0);

console.log('chart.utils: all checks passed');
