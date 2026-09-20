export interface Job {
  id: number;
  title: string;
  company: string;
  url: string;
  location: string;
  postedAt: number;
  points: number;
}

/** One entry per requested id, in request order: a failure is a result, not a gap in the list. */
export type JobResult = { id: number; job: Job } | { id: number; error: string };

export const isLoaded = (result: JobResult): result is { id: number; job: Job } => 'job' in result;
