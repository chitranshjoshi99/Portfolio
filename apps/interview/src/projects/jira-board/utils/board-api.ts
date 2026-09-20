import { API_LATENCY_MS } from '../constants/jira-board.constants';
import type { MoveRequest } from '../jira-board.types';

export const serverControl = { failNext: false, requests: 0 };
export const serverLog: string[] = [];

/** PUT /rest/agile/1.0/issue/rank — "rank X after Y in column Z". */
export function persistMove(request: MoveRequest): Promise<void> {
  serverControl.requests += 1;
  const shouldFail = serverControl.failNext;
  serverControl.failNext = false;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const where = request.afterId ? `after ${request.afterId}` : request.beforeId ? `before ${request.beforeId}` : 'as only card';
      if (shouldFail) {
        serverLog.unshift(`✗ rank ${request.issueId} → ${request.columnId} ${where} — 409 conflict`);
        reject(new Error('409 — someone else moved this issue'));
        return;
      }
      serverLog.unshift(`✓ rank ${request.issueId} → ${request.columnId} ${where}`);
      resolve();
    }, API_LATENCY_MS);
  });
}
