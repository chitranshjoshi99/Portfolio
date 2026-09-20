import type { SeriesKey, Sprint } from '../velocity-chart.types';

/** The "mock data" the prompt hands you. */
export const SPRINTS: Sprint[] = [
  { id: 's31', name: 'Sprint 31', committed: 42, completed: 30 },
  { id: 's32', name: 'Sprint 32', committed: 38, completed: 35 },
  { id: 's33', name: 'Sprint 33', committed: 45, completed: 41 },
  { id: 's34', name: 'Sprint 34', committed: 40, completed: 22 },
  { id: 's35', name: 'Sprint 35', committed: 36, completed: 36 },
  { id: 's36', name: 'Sprint 36', committed: 48, completed: 39 },
  { id: 's37', name: 'Sprint 37', committed: 44, completed: 43 },
  { id: 's38', name: 'Sprint 38', committed: 51, completed: 37 },
  { id: 's39', name: 'Sprint 39', committed: 39, completed: 38 },
  { id: 's40', name: 'Sprint 40', committed: 47, completed: 44 },
  { id: 's41', name: 'Sprint 41', committed: 53, completed: 48 },
  { id: 's42', name: 'Sprint 42', committed: 46, completed: 45 },
];

export const SERIES: { key: SeriesKey; label: string }[] = [
  { key: 'committed', label: 'Commitment' },
  { key: 'completed', label: 'Completed' },
];

export const RANGE_OPTIONS = [6, 8, 12];
export const AVERAGE_WINDOW = 3;
export const TARGET_TICKS = 5;
export const TOOLTIP_GAP = 8;
