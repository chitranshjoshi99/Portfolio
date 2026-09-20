import type { Job } from '../job-board.types';
import { hostOf, relativeTime } from '../utils/jobs.utils';

interface JobCardProps {
  job: Job;
  now: number;
}

export function JobCard({ job, now }: JobCardProps) {
  const host = hostOf(job.url);
  return (
    <li className="jb__item">
      <h3 className="jb__title">
        <a href={job.url} target="_blank" rel="noopener noreferrer">
          {job.title}
        </a>
        {host && <span className="jb__host"> ({host})</span>}
      </h3>
      <p className="jb__meta">
        <span>{job.company}</span>
        <span>·</span>
        <span>{job.location}</span>
        <span>·</span>
        {/* The machine-readable time stays in the markup; the text is what a human reads. */}
        <time dateTime={new Date(job.postedAt).toISOString()}>{relativeTime(job.postedAt, now)}</time>
        <span>·</span>
        <span>{job.points} points</span>
      </p>
    </li>
  );
}

interface FailedCardProps {
  id: number;
  error: string;
  isRetrying: boolean;
  onRetry: (id: number) => void;
}

export function FailedCard({ id, error, isRetrying, onRetry }: FailedCardProps) {
  return (
    <li className="jb__item jb__item--failed">
      <p className="jb__error">
        Job {id} failed to load: {error}
      </p>
      <button type="button" className="jb__btn" disabled={isRetrying} onClick={() => onRetry(id)}>
        {isRetrying ? 'Retrying…' : 'Retry'}
      </button>
    </li>
  );
}

export function SkeletonCard() {
  return (
    <li className="jb__item jb__item--skeleton" aria-hidden="true">
      <span className="jb__bar jb__bar--title" />
      <span className="jb__bar jb__bar--meta" />
    </li>
  );
}
