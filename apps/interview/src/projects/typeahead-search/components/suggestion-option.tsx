import type { City } from '../typeahead-search.types';
import { HighlightedText } from './highlighted-text';

interface SuggestionOptionProps {
  city: City;
  query: string;
  id: string;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
}

export function SuggestionOption({ city, query, id, isActive, onHover, onSelect }: SuggestionOptionProps) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={isActive}
      className={`ta__option${isActive ? ' ta__option--active' : ''}`}
      onMouseMove={onHover}
      // pointerdown fires before the input's blur, so the click can't be cancelled by closing.
      onPointerDown={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <span className="ta__option-name">
        <HighlightedText text={city.name} query={query} />
      </span>
      <span className="ta__option-meta">
        <HighlightedText text={city.country} query={query} />
        <span className="ta__option-pop">{(city.population / 1_000_000).toFixed(1)}M</span>
      </span>
    </li>
  );
}
