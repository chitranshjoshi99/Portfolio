import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TASKS } from '../constants/tasks';
import { buildDoc, clampWidth, DEMO_MAX_WIDTH } from '../utils/css-tasks.utils';

export function useCssTasks() {
  const [selectedId, setSelectedId] = useState(TASKS[0].id);
  const [requestedWidth, setRequestedWidth] = useState(TASKS[0].widths[0]);
  /** Bumped to remount the frame: the demos keep state (an open menu, a stored consent). */
  const [runKey, setRunKey] = useState(0);
  const [available, setAvailable] = useState(DEMO_MAX_WIDTH);
  const stageRef = useRef<HTMLDivElement>(null);

  const task = TASKS.find((item) => item.id === selectedId) ?? TASKS[0];
  const srcDoc = useMemo(() => buildDoc(task), [task]);
  const width = clampWidth(requestedWidth, available);

  // The frame is sized in px so the media queries fire against the frame, not the app window —
  // which means the app has to know how much room it actually has.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const select = useCallback((id: string) => {
    const next = TASKS.find((item) => item.id === id) ?? TASKS[0];
    setSelectedId(next.id);
    setRequestedWidth(next.widths[0]);
    setRunKey((key) => key + 1);
  }, []);

  return {
    tasks: TASKS,
    task,
    selectedId,
    select,
    srcDoc,
    width,
    setWidth: setRequestedWidth,
    maxWidth: clampWidth(DEMO_MAX_WIDTH, available),
    runKey,
    reload: () => setRunKey((key) => key + 1),
    stageRef,
  };
}
