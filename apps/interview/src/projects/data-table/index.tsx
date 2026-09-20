import { TablePagination } from './components/table-pagination';
import { TaskRow } from './components/task-row';
import { STATUS_LABELS, STATUSES } from './constants/tasks';
import './data-table.css';
import type { SortColumn } from './data-table.types';
import { useTaskTable } from './hooks/use-task-table';
import { ariaSort } from './utils/table.utils';

const COLUMNS: { id: SortColumn; label: string; numeric?: boolean }[] = [
  { id: 'key', label: 'Key' },
  { id: 'summary', label: 'Summary' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'status', label: 'Status' },
  { id: 'points', label: 'Points', numeric: true },
  { id: 'updated', label: 'Updated', numeric: true },
];

export default function DataTablePage() {
  const t = useTaskTable();

  return (
    <section className="dt">
      <div className="dt__toolbar">
        <input
          className="dt__search"
          type="search"
          placeholder="Search key, summary or assignee…"
          aria-label="Search issues"
          value={t.searchDraft}
          onChange={(event) => t.setSearchDraft(event.target.value)}
        />

        <div className="dt__tabs" role="group" aria-label="Filter by status">
          <button
            type="button"
            className={`dt__tab ${t.query.status === 'all' ? 'is-on' : ''}`}
            aria-pressed={t.query.status === 'all'}
            onClick={() => t.setStatus('all')}
          >
            All
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`dt__tab ${t.query.status === status ? 'is-on' : ''}`}
              aria-pressed={t.query.status === status}
              onClick={() => t.setStatus(status)}
            >
              {STATUS_LABELS[status]}
              {t.statusCounts && <span className="dt__count">{t.statusCounts[status]}</span>}
            </button>
          ))}
        </div>

        <button type="button" className="dt__btn" onClick={t.reset}>
          Reset
        </button>
        <button type="button" className="dt__btn" onClick={t.failNext}>
          Fail next request
        </button>
        <span className="dt__state" role="status">
          {t.error ? 'error' : t.loading ? 'loading…' : 'idle'}
        </span>
      </div>

      {t.error && (
        <p className="dt__error" role="alert">
          {t.error}{' '}
          <button type="button" className="dt__btn" onClick={t.retry}>
            Retry
          </button>
        </p>
      )}

      <div className={`dt__table-wrap ${t.isStale ? 'is-stale' : ''}`}>
        <table className="dt__table">
          <caption className="dt__sr">
            Issues, {t.total} matching, page {t.query.page} of {t.pages}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="dt__expand-cell">
                <span className="dt__sr">Expand</span>
              </th>
              {COLUMNS.map((column) => (
                <th key={column.id} scope="col" aria-sort={ariaSort(t.query, column.id)}>
                  <button type="button" className="dt__sort" onClick={() => t.sortBy(column.id)}>
                    {column.label}
                    <span aria-hidden="true" className="dt__arrow">
                      {t.query.sort === column.id ? (t.query.dir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isExpanded={t.expanded.has(task.id)}
                subtasks={t.subtasks[task.id]}
                onToggle={t.toggleExpand}
              />
            ))}
            {t.isEmpty && (
              <tr>
                <td colSpan={7} className="dt__empty">
                  Nothing matches “{t.query.search}”
                  {t.query.status !== 'all' && ` in ${STATUS_LABELS[t.query.status]}`}.{' '}
                  <button type="button" className="dt__btn" onClick={t.reset}>
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={t.query.page}
        pageSize={t.query.pageSize}
        total={t.total}
        pages={t.pages}
        onPage={t.goToPage}
        onPageSize={t.setPageSize}
      />

      <ol className="dt__log">
        {t.log.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
