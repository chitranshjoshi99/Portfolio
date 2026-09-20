export interface TabDefinition {
  id: string;
  label: string;
  disabled?: boolean;
}

/** automatic: arrows select as they move (few, cheap panels). manual: arrows move focus, Enter/Space selects. */
export type ActivationMode = 'automatic' | 'manual';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PanelData {
  title: string;
  lines: string[];
  loadedAt: number;
}
