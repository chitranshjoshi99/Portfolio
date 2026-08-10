import { STATE_FILTERS } from '../constants/feature-flags.constants';
import type { FlagState } from '../feature-flags.types';

interface FlagToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  stateFilter: FlagState | 'all';
  onStateFilterChange: (state: FlagState | 'all') => void;
  total: number;
  isLoading: boolean;
}

export function FlagToolbar({
  search,
  onSearchChange,
  stateFilter,
  onStateFilterChange,
  total,
  isLoading,
}: FlagToolbarProps) {
  return (
    <div className="ff__toolbar">
      <input
        className="ff__search"
        type="search"
        value={search}
        placeholder="Search key, name or owner…"
        aria-label="Search flags"
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <div className="ff__filters" role="group" aria-label="Filter by state">
        {STATE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`ff__chip${filter.value === stateFilter ? ' ff__chip--active' : ''}`}
            aria-pressed={filter.value === stateFilter}
            onClick={() => onStateFilterChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <span className="ff__count" aria-live="polite">
        {isLoading ? 'Loading…' : `${total} flag${total === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}
