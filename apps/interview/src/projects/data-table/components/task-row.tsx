import { STATUS_LABELS } from '../constants/tasks';
import type { Subtask, Task } from '../data-table.types';

interface TaskRowProps {
  task: Task;
  isExpanded: boolean;
  subtasks: Subtask[] | 'loading' | undefined;
  onToggle: (task: Task) => void;
}

export function TaskRow({ task, isExpanded, subtasks, onToggle }: TaskRowProps) {
  const canExpand = task.subtaskCount > 0;

  return (
    <>
      <tr className={isExpanded ? 'is-expanded' : undefined}>
        <td className="dt__expand-cell">
          {canExpand ? (
            <button
              type="button"
              className="dt__expand"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Hide' : 'Show'} ${task.subtaskCount} subtasks of ${task.key}`}
              onClick={() => onToggle(task)}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="dt__expand dt__expand--none" aria-hidden="true" />
          )}
        </td>
        <td className="dt__key">{task.key}</td>
        <td className="dt__summary">{task.summary}</td>
        <td>{task.assignee}</td>
        <td>
          <span className={`dt__status dt__status--${task.status}`}>{STATUS_LABELS[task.status]}</span>
        </td>
        <td className="dt__num">{task.points}</td>
        <td className="dt__num">{task.updated}</td>
      </tr>

      {isExpanded && (
        <tr className="dt__subrow">
          {/* One cell spanning the table: a nested <table> would break column alignment and the a11y tree. */}
          <td colSpan={7}>
            {subtasks === 'loading' || subtasks === undefined ? (
              <p className="dt__muted">Loading subtasks…</p>
            ) : (
              <ul className="dt__subtasks">
                {subtasks.map((subtask) => (
                  <li key={subtask.id}>
                    <span className="dt__key">{subtask.key}</span>
                    <span>{subtask.summary}</span>
                    <span className={`dt__status dt__status--${subtask.status}`}>{STATUS_LABELS[subtask.status]}</span>
                    <span className="dt__muted">{subtask.assignee}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
