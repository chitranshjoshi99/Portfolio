export interface Sprint {
  id: string;
  name: string;
  /** Story points in the sprint when it started (Jira's grey bar). */
  committed: number;
  /** Story points done when it closed (Jira's green bar). */
  completed: number;
}

export type SeriesKey = 'committed' | 'completed';

export interface NiceScale {
  /** Axis top — always ≥ the data max, always a multiple of step. */
  max: number;
  step: number;
  ticks: number[];
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TooltipPlacement {
  left: number;
  top: number;
  /** Where the tooltip ended up relative to the bar after the fit checks. */
  side: 'above' | 'right' | 'left';
}
