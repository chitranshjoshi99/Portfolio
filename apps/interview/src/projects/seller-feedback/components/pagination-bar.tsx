interface PaginationBarProps {
  page: number;
  pageCount: number;
  onGoToPage: (page: number) => void;
}

export function PaginationBar({ page, pageCount, onGoToPage }: PaginationBarProps) {
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" className="btn" disabled={page <= 1} onClick={() => onGoToPage(page - 1)}>
        ← Prev
      </button>

      <span className="pager__status" aria-live="polite">
        Page {page} of {pageCount}
      </span>

      <button type="button" className="btn" disabled={page >= pageCount} onClick={() => onGoToPage(page + 1)}>
        Next →
      </button>
    </nav>
  );
}
