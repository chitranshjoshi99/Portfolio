import { PAGE_SIZES } from '../constants/tasks';
import { pageWindow, rangeLabel } from '../utils/table.utils';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

export function TablePagination({ page, pageSize, total, pages, onPage, onPageSize }: TablePaginationProps) {
  return (
    <div className="dt__pager">
      <span className="dt__range">{rangeLabel(page, pageSize, total)}</span>

      <label className="dt__size">
        Rows
        <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <nav className="dt__pages" aria-label="Pagination">
        <button type="button" className="dt__page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ‹ Prev
        </button>
        {pageWindow(page, pages).map((value, index) =>
          value === null ? (
            // A gap is not a button: it is not reachable, and it is hidden from the reader too.
            <span key={`gap-${index}`} className="dt__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={value}
              type="button"
              className={`dt__page-btn ${value === page ? 'is-current' : ''}`}
              aria-current={value === page ? 'page' : undefined}
              aria-label={`Page ${value}`}
              onClick={() => onPage(value)}
            >
              {value}
            </button>
          ),
        )}
        <button type="button" className="dt__page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next ›
        </button>
      </nav>
    </div>
  );
}
