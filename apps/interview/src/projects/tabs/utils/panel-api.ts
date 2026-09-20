import { LATENCY_MS, PANEL_CONTENT } from '../constants/tabs.constants';
import type { PanelData } from '../tabs.types';

export const requestLog: string[] = [];
export const failureControl = { failNext: false };

/** GET /issue/CONF-4121/<tab> stand-in. Logs every call so the page can prove what was fetched. */
export function fetchPanel(id: string): Promise<PanelData> {
  requestLog.push(id);
  const shouldFail = failureControl.failNext;
  failureControl.failNext = false;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) reject(new Error(`GET /issue/CONF-4121/${id} → 500`));
      else resolve({ title: id, lines: PANEL_CONTENT[id] ?? [], loadedAt: Date.now() });
    }, LATENCY_MS);
  });
}
