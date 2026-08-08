import { MESSAGE } from '../constants/typeahead.constants';
import type { City } from '../typeahead-search.types';
import { SuggestionOption } from './suggestion-option';

interface SuggestionListProps {
  id: string;
  suggestions: City[];
  query: string;
  activeIndex: number;
  isLoading: boolean;
  error: string | null;
  getOptionId: (index: number) => string;
  onHover: (index: number) => void;
  onSelect: (city: City) => void;
}

export function SuggestionList({
  id,
  suggestions,
  query,
  activeIndex,
  isLoading,
  error,
  getOptionId,
  onHover,
  onSelect,
}: SuggestionListProps) {
  const isEmpty = suggestions.length === 0;

  return (
    <ul className="ta__list" id={id} role="listbox" aria-label="City suggestions">
      {error ? (
        <li className="ta__status ta__status--error" role="alert">
          {error}
        </li>
      ) : isEmpty ? (
        <li className="ta__status">{isLoading ? MESSAGE.loading : MESSAGE.empty}</li>
      ) : (
        suggestions.map((city, index) => (
          <SuggestionOption
            key={city.id}
            city={city}
            query={query}
            id={getOptionId(index)}
            isActive={index === activeIndex}
            onHover={() => onHover(index)}
            onSelect={() => onSelect(city)}
          />
        ))
      )}
    </ul>
  );
}
