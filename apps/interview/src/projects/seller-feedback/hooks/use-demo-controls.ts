import { useCallback, useState } from 'react';
import { FAILURE_RATE } from '../constants/seller-feedback.constants';
import { resetFeedbackDb, setMutationFailureRate } from '../utils/feedback-api';

interface UseDemoControls {
  failuresForced: boolean;
  toggleFailures: () => void;
  resetData: () => void;
}

/**
 * Not part of the product — it drives the fake backend so the failure path can be
 * shown on demand instead of waiting for the random 30% to hit.
 */
export function useDemoControls(reload: () => void): UseDemoControls {
  const [failuresForced, setFailuresForced] = useState(false);

  // Side effect stays outside the state updater — updaters run twice under StrictMode.
  const toggleFailures = useCallback(() => {
    const next = !failuresForced;
    setMutationFailureRate(next ? 1 : FAILURE_RATE.mutation);
    setFailuresForced(next);
  }, [failuresForced]);

  const resetData = useCallback(() => {
    resetFeedbackDb();
    reload();
  }, [reload]);

  return { failuresForced, toggleFailures, resetData };
}
