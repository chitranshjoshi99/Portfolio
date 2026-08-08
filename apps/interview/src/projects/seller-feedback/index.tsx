import { DemoControls } from './components/demo-controls';
import { FeedbackRow } from './components/feedback-row';
import { FeedbackToolbar } from './components/feedback-toolbar';
import { PaginationBar } from './components/pagination-bar';
import { MESSAGE } from './constants/seller-feedback.constants';
import { useDemoControls } from './hooks/use-demo-controls';
import { useFeedbackConsole } from './hooks/use-feedback-console';
import './seller-feedback.css';

export default function SellerFeedbackPage() {
  const feedback = useFeedbackConsole();
  const demo = useDemoControls(feedback.reload);

  return (
    <section className="console">
      <DemoControls
        failuresForced={demo.failuresForced}
        onToggleFailures={demo.toggleFailures}
        onResetData={demo.resetData}
      />

      <FeedbackToolbar
        search={feedback.search}
        onSearchChange={feedback.setSearch}
        status={feedback.status}
        onStatusChange={feedback.setStatus}
        total={feedback.total}
        isLoading={feedback.isLoading}
      />

      {feedback.listError ? (
        <p className="console__error" role="alert">
          {feedback.listError}
          <button type="button" className="link" onClick={feedback.reload}>
            Retry
          </button>
        </p>
      ) : feedback.items.length === 0 && !feedback.isLoading ? (
        <p className="console__empty">{MESSAGE.empty}</p>
      ) : (
        <ul className={`console__list${feedback.isLoading ? ' console__list--stale' : ''}`}>
          {feedback.items.map((item) => (
            <FeedbackRow
              key={item.id}
              feedback={item}
              isPending={feedback.pendingIds.has(item.id)}
              failure={feedback.failedById[item.id]}
              onApprove={() => feedback.setFeedbackStatus(item.id, 'approved')}
              onReject={() => feedback.setFeedbackStatus(item.id, 'rejected')}
              onRetry={() => feedback.retry(item.id)}
              onDismissFailure={() => feedback.dismissFailure(item.id)}
            />
          ))}
        </ul>
      )}

      <PaginationBar page={feedback.page} pageCount={feedback.pageCount} onGoToPage={feedback.goToPage} />
    </section>
  );
}
