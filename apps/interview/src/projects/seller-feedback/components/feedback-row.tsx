import { STATUS_LABEL } from '../constants/seller-feedback.constants';
import type { Feedback } from '../seller-feedback.types';
import type { FailedMutation } from '../hooks/use-feedback-console';

interface FeedbackRowProps {
  feedback: Feedback;
  isPending: boolean;
  failure: FailedMutation | undefined;
  onApprove: () => void;
  onReject: () => void;
  onRetry: () => void;
  onDismissFailure: () => void;
}

export function FeedbackRow({
  feedback,
  isPending,
  failure,
  onApprove,
  onReject,
  onRetry,
  onDismissFailure,
}: FeedbackRowProps) {
  return (
    <li className={`row${isPending ? ' row--pending' : ''}`}>
      <div className="row__main">
        <div className="row__head">
          <span className="row__buyer">{feedback.buyer}</span>
          <span className="row__order">{feedback.orderId}</span>
          <span className="row__rating" aria-label={`${feedback.rating} out of 5`}>
            {'★'.repeat(feedback.rating)}
            <span className="row__rating-dim">{'★'.repeat(5 - feedback.rating)}</span>
          </span>
          <span className={`badge badge--${feedback.status}`}>{STATUS_LABEL[feedback.status]}</span>
        </div>
        <p className="row__comment">{feedback.comment}</p>
        {failure && (
          <p className="row__error" role="alert">
            {failure.message}
            <button type="button" className="link" onClick={onRetry}>
              Retry
            </button>
            <button type="button" className="link" onClick={onDismissFailure}>
              Dismiss
            </button>
          </p>
        )}
      </div>

      <div className="row__actions">
        <button
          type="button"
          className="btn btn--approve"
          disabled={isPending || feedback.status === 'approved'}
          onClick={onApprove}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn btn--reject"
          disabled={isPending || feedback.status === 'rejected'}
          onClick={onReject}
        >
          Reject
        </button>
        {isPending && <span className="row__spinner" aria-label="Saving" />}
      </div>
    </li>
  );
}
