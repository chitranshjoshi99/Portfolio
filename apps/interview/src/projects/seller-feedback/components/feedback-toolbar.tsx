import { STATUS_FILTERS } from '../constants/seller-feedback.constants';
import type { FeedbackQuery } from '../seller-feedback.types';

interface FeedbackToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  status: FeedbackQuery['status'];
  onStatusChange: (status: FeedbackQuery['status']) => void;
  total: number;
  isLoading: boolean;
}

export function FeedbackToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  total,
  isLoading,
}: FeedbackToolbarProps) {
  return (
    <div className="console__toolbar">
      <input
        className="console__search"
        type="search"
        value={search}
        placeholder="Search buyer, order or comment…"
        aria-label="Search feedback"
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <div className="console__filters" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`chip${filter.value === status ? ' chip--active' : ''}`}
            aria-pressed={filter.value === status}
            onClick={() => onStatusChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <span className="console__count" aria-live="polite">
        {isLoading ? 'Loading…' : `${total} result${total === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}
