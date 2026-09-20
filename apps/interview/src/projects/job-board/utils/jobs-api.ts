import { ALL_JOBS, FLAKY_IDS } from '../constants/jobs.ts';
import type { Job } from '../job-board.types.ts';

export const apiStats = { inFlight: 0, peakInFlight: 0, requests: 0 };

/** Retrying a flaky id succeeds: a failure that can never clear is not a retry story. */
const recovered = new Set<number>();

export const resetApiStats = (): void => {
  apiStats.inFlight = 0;
  apiStats.peakInFlight = 0;
  apiStats.requests = 0;
  recovered.clear();
};

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** One cheap call for the whole ordered list of ids — the shape Hacker News and most job APIs use. */
export async function fetchJobIds(signal?: AbortSignal): Promise<number[]> {
  await delay(200, signal);
  return ALL_JOBS.map((job) => job.id);
}

/** One call per posting. Latency varies, so responses arrive out of order — order is the caller's job. */
export async function fetchJob(id: number, signal?: AbortSignal): Promise<Job> {
  apiStats.requests += 1;
  apiStats.inFlight += 1;
  apiStats.peakInFlight = Math.max(apiStats.peakInFlight, apiStats.inFlight);
  try {
    await delay(120 + ((id * 37) % 420), signal);
    if (FLAKY_IDS.has(id) && !recovered.has(id)) {
      recovered.add(id);
      throw new Error('502 — upstream timed out');
    }
    const job = ALL_JOBS.find((item) => item.id === id);
    if (!job) throw new Error(`404 — no job ${id}`);
    return job;
  } finally {
    apiStats.inFlight -= 1;
  }
}
